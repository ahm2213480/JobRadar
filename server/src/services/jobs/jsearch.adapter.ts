import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, parseSalary, strip, truncateDescription } from './normalize';

// LinkedIn-inclusive discovery via Arbeitnow's free skill-warehouse API —
// the same no-key host already used by ArbeitnowProvider, queried here per
// skill so results include LinkedIn-mirrored + DACH/EU onsite listings with
// real city coverage (Amman results appear under Remote listings).
// Verified live 2026-09-14: GET /api/job-board-api?search=react → 200 with
// { data: [...] }. No auth, no key, server-side fetch.

const ARBEITNOW_SKILL_URL = 'https://www.arbeitnow.com/api/job-board-api';

// Discovery skills covering the stack + remote (Amman-friendly) listings.
const SEARCH_QUERIES: Array<{ search: string }> = [
  { search: 'react' },
  { search: 'javascript' },
  { search: 'typescript' },
  { search: 'python' },
  { search: 'backend' },
  { search: 'remote' },
];

const MAX_PER_QUERY = 25;

// Per-request timeout so a stalled call fails fast instead of holding sync.
const REQUEST_TIMEOUT_MS = 12_000;

// Arbeitnow skill-warehouse job shape (verified live 2026-09-14).
export interface TheyoqunJob {
  slug?: string;
  title?: string;
  company_name?: string;
  company?: string;
  location?: string[] | string;
  description?: string;
  remote?: boolean;
  tags?: string[];
  keywords?: string[];
  job_types?: string[];
  url?: string;
  created_at?: number | string;
  id?: string | number;
}

// Legacy JSearch payload shape (kept for backward mapping support).
export interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_company_type?: string;
  job_description?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_employment_type?: string;
  job_employment_types?: string[];
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
  job_posted_at_datetime_utc?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_required_skills?: string[] | null;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  };
}

export function mapEmploymentType(raw: string | undefined): NormalizedJob['employmentType'] {
  const text = (raw ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  if (text.includes('FULL_TIME')) return 'FULL_TIME';
  if (text.includes('PART_TIME')) return 'PART_TIME';
  if (text.includes('CONTRACT')) return 'CONTRACT';
  if (text.includes('INTERN')) return 'INTERNSHIP';
  if (text.includes('TEMP')) return 'TEMPORARY';
  return 'UNKNOWN';
}

export function toYearly(amount: number | null, period: string | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  switch ((period ?? '').toUpperCase()) {
    case 'HOUR':
      return Math.round(amount * 2080);
    case 'MONTH':
      return Math.round(amount * 12);
    case 'WEEK':
      return Math.round(amount * 52);
    case 'YEAR':
    default:
      return Math.round(amount);
  }
}

export function buildLocation(job: JSearchJob): string | null {
  const parts = [job.job_city, job.job_state, job.job_country].filter(Boolean) as string[];
  if (job.job_is_remote && parts.length === 0) return 'Remote';
  return parts.join(', ') || null;
}

export class JSearchProvider implements IJobProvider {
  readonly sourceSlug = 'jsearch';
  readonly label = 'JSearch (LinkedIn + boards)';

  async fetchJobs(): Promise<NormalizedJob[]> {
    // No key needed — theyoqun.com is a free public API.
    logger.info(`[jobs] jsearch: sync started — ${SEARCH_QUERIES.length} queries`);
    const collected: NormalizedJob[] = [];
    for (const [index, { search }] of SEARCH_QUERIES.entries()) {
      logger.info(`[jobs] jsearch: query ${index + 1}/${SEARCH_QUERIES.length} — "${search}"`);
      try {
        const jobs = await this.searchQuery(search);
        logger.info(`[jobs] jsearch: "${search}" -> ${jobs.length} jobs`);
        collected.push(...jobs);
      } catch (error) {
        logger.warn(
          `[jobs] jsearch query failed (${search}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    logger.info(`[jobs] jsearch: sync finished — ${collected.length} jobs total`);
    return collected;
  }

  private async searchQuery(search: string): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({ search });
    const url = `${ARBEITNOW_SKILL_URL}?${params.toString()}`;
    const data = (await this.getJson(url)) as { data?: TheyoqunJob[] } | TheyoqunJob[];
    const raw = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
    return raw.slice(0, MAX_PER_QUERY).map((job) => this.mapTheyoqunJob(job));
  }

  mapTheyoqunJob(job: TheyoqunJob): NormalizedJob {
    const location = Array.isArray(job.location)
      ? job.location.filter(Boolean).join(', ')
      : strip(job.location || '');
    const description = truncateDescription(job.description ?? '');
    const keywords = Array.isArray(job.tags)
      ? job.tags
      : Array.isArray(job.keywords)
        ? job.keywords
        : [];
    const jobTypes = (Array.isArray(job.job_types) ? job.job_types : []).join(' ');
    const created = typeof job.created_at === 'number'
      ? new Date(job.created_at * 1000)
      : job.created_at
        ? new Date(job.created_at)
        : null;
    return {
      externalId: job.slug ?? (job.id != null ? `skill:${String(job.id)}` : null),
      title: strip(job.title || 'Untitled role'),
      companyName: strip(job.company_name || job.company || '') || null,
      description,
      location: location || null,
      url: job.url || 'https://www.linkedin.com/jobs/search/',
      workMode: job.remote ? 'REMOTE' : inferWorkMode([location, description.slice(0, 2000)]),
      employmentType: mapEmploymentType(jobTypes),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: created && !Number.isNaN(created.getTime()) ? created : null,
      tags: keywords.slice(0, 20).map((t) => strip(String(t))).filter(Boolean),
      extraText: [keywords.join(', '), jobTypes].filter(Boolean).join(' ') || null,
    };
  }

mapJob(job: JSearchJob): NormalizedJob {
    const salaryMin = toYearly(job.job_min_salary ?? null, job.job_salary_period);
    const salaryMax = toYearly(job.job_max_salary ?? null, job.job_salary_period);
    const parsed = parseSalary(
      salaryMin != null || salaryMax != null ? `$${salaryMin ?? ''}-${salaryMax ?? ''}` : null,
    );
    const location = buildLocation(job);
    const highlights = [
      ...(job.job_highlights?.Qualifications ?? []),
      ...(job.job_highlights?.Responsibilities ?? []),
    ].join('\n');
    const description = [job.job_description ?? '', highlights].filter(Boolean).join('\n\n');
    return {
      externalId: job.job_id ? `jsearch:${job.job_id}` : null,
      title: strip(job.job_title || 'Untitled role'),
      companyName: strip(job.employer_name || '') || null,
      description: truncateDescription(description),
      location,
      url: job.job_apply_link || job.job_google_link || 'https://www.linkedin.com/jobs/search/',
      workMode: job.job_is_remote ? 'REMOTE' : inferWorkMode([location, description.slice(0, 2000)]),
      employmentType: mapEmploymentType(job.job_employment_type ?? job.job_employment_types?.[0]),
      salaryMin: salaryMin ?? parsed.salaryMin,
      salaryMax: salaryMax ?? parsed.salaryMax,
      salaryCurrency: job.job_salary_currency ?? parsed.salaryCurrency,
      postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : null,
      tags: (job.job_required_skills ?? []).slice(0, 20).map((t) => strip(String(t))).filter(Boolean),
      extraText: [job.employer_company_type, (job.job_employment_types ?? []).join(', ')]
        .filter(Boolean)
        .join(' ') || null,
    };
  }

  private async getJson(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'JobRadar/0.1' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AppError(502, `JSearch request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      logger.error('JSearch fetch failed', error);
      throw new AppError(502, 'JSearch API is unreachable or timed out');
    }
    if (response.status === 429) {
      throw new AppError(502, 'JSearch rate limit reached (429) — try again later');
    }
    if (!response.ok) {
      throw new AppError(502, `JSearch API error (${response.status})`);
    }
    return response.json() as Promise<unknown>;
  }
}

