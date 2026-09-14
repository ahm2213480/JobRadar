import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, parseSalary, strip, truncateDescription } from './normalize';

// JSearch (RapidAPI) — Google-for-Jobs aggregator incl. LinkedIn listings.
// Docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
// Auth: X-RapidAPI-Key header, server-side only. Without a key → [].

const JSEARCH_HOST = 'jsearch.p.rapidapi.com';

// Per-request timeout so a stalled RapidAPI call fails fast instead of
// holding the whole sync. Retries are intentionally NOT added: 8 sequential
// queries × retry would multiply worst-case sync time and burn the free tier.
const REQUEST_TIMEOUT_MS = 12_000;

// Small pause between queries to respect RapidAPI rate limits.
const QUERY_DELAY_MS = 500;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Discovery queries covering Amman / Jordan / GCC / Europe / US / remote.
const SEARCH_QUERIES: Array<{ query: string; numPages: number }> = [
  { query: 'software engineer in Amman, Jordan', numPages: 1 },
  { query: 'developer in Jordan', numPages: 1 },
  { query: 'software engineer in Riyadh, Saudi Arabia', numPages: 1 },
  { query: 'developer in Dubai, UAE', numPages: 1 },
  { query: 'software engineer in London, UK', numPages: 1 },
  { query: 'developer in Berlin, Germany', numPages: 1 },
  { query: 'software engineer in United States', numPages: 1 },
  { query: 'remote software engineer', numPages: 1 },
];

const MAX_PER_QUERY = 10;

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
    const apiKey = env.JSEARCH_API_KEY?.trim();
    if (!apiKey) {
      logger.info('[jobs] jsearch: JSEARCH_API_KEY not set — skipping provider');
      return [];
    }
    logger.info(`[jobs] jsearch: sync started — ${SEARCH_QUERIES.length} queries`);
    const collected: NormalizedJob[] = [];
    for (const [index, { query, numPages }] of SEARCH_QUERIES.entries()) {
      logger.info(`[jobs] jsearch: query ${index + 1}/${SEARCH_QUERIES.length} — "${query}"`);
      try {
        const jobs = await this.searchQuery(apiKey, query, numPages);
        logger.info(`[jobs] jsearch: "${query}" -> ${jobs.length} jobs`);
        collected.push(...jobs);
      } catch (error) {
        logger.warn(
          `[jobs] jsearch query failed (${query}): ${error instanceof Error ? error.message : error}`,
        );
      }
      if (index < SEARCH_QUERIES.length - 1) {
        await delay(QUERY_DELAY_MS);
      }
    }
    logger.info(`[jobs] jsearch: sync finished — ${collected.length} jobs total`);
    return collected;
  }

  private async searchQuery(apiKey: string, query: string, numPages: number): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      query,
      page: '1',
      num_pages: String(numPages),
      date_posted: 'month',
    });
    const url = `https://${JSEARCH_HOST}/search?${params.toString()}`;
    const data = (await this.getJson(url, apiKey)) as { data?: JSearchJob[] };
    const raw = Array.isArray(data.data) ? data.data : [];
    return raw.slice(0, MAX_PER_QUERY).map((job) => this.mapJob(job));
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

  private async getJson(url: string, apiKey: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'JobRadar/0.1',
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': JSEARCH_HOST,
        },
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

