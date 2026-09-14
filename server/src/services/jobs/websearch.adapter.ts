import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, strip, truncateDescription } from './normalize';

/**
 * WebSearch (Serper.dev Google Search) — the user's "look it up on the web
 * and take me to the source" discovery mode. Instead of scraping LinkedIn
 * directly (ToS-prohibited) we run user-style queries (title + city/country)
 * through Google's SERP via Serper's licensed API, then keep results whose
 * origin is a real job-listing page — original URL preserved so the user
 * lands on LinkedIn / company careers / job board.
 *
 * Docs: POST https://google.serper.dev/search
 * Headers: { 'X-API-KEY': <key>, 'Content-Type': 'application/json' }
 * Body: { q, gl, hl, num }
 * Response: { organic: [{ title, link, snippet, position, ... }] }
 * Free tier: 2,500 queries (no card). Register at https://serper.dev.
 * Without SERPER_API_KEY this provider returns [] and other sources sync.
 */

const SERPER_ENDPOINT = 'https://google.serper.dev/search';

// Job-listing origins we consider "real job pages" worth keeping.
const JOB_HOST_KEYWORDS = [
  'linkedin.com/jobs',
  'indeed.com',
  'glassdoor.com',
  'careers.',
  'jobs.',
  '.jobs/',
  'greenhouse.io',
  'lever.co',
  'workable.com',
  'breezy.hr',
  'smartrecruiters',
  'jobvite',
  'icims',
  'workday',
  'jooble',
  'bayt.com',
  'gulftalent',
  'akhtaboot',
  'zamit',
  'wuzzuf',
  'getro.com',
  'jobbio',
  'remotive',
];

// User-style discovery queries per geography (Amman / Jordan / GCC / EU / US / remote).
const SEARCH_QUERIES: Array<{ query: string; gl: string }> = [
  { query: 'software engineer job Amman Jordan', gl: 'jo' },
  { query: 'react developer jobs Jordan', gl: 'jo' },
  { query: 'full stack developer job Riyadh Saudi Arabia', gl: 'sa' },
  { query: 'backend developer job Dubai UAE', gl: 'ae' },
  { query: 'software engineer job London UK', gl: 'gb' },
  { query: 'developer job Berlin Germany', gl: 'de' },
  { query: 'software engineer job United States', gl: 'us' },
  { query: 'remote software engineer job', gl: 'us' },
];

const MAX_PER_QUERY = 15;
const REQUEST_TIMEOUT_MS = 12_000;

export interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
  date?: string;
}

export interface SerperSearchResponse {
  searchParameters?: { q?: string; gl?: string; hl?: string; num?: number };
  organic?: SerperOrganicResult[];
}

/** Heuristic company name from a job URL (e.g. careers.acme.com -> Acme). */
export function companyFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const label =
      host.replace(/^(www\.|careers\.|jobs\.|boards\.)/, '').split('.')[0] || null;
    if (!label) return null;
    // Capitalize dashed/snake labels.
    const pretty = label
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return pretty || null;
  } catch {
    return null;
  }
}

export function isJobListingUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return JOB_HOST_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function toJobResult(result: SerperOrganicResult, fallbackLocation: string): NormalizedJob {
  const url = strip(result.link || '');
  const title = strip(result.title || 'Untitled role');
  return {
    externalId: url ? `web:${url}` : null,
    title,
    companyName: companyFromUrl(url) || null,
    description: truncateDescription(
      [result.snippet || '', result.title || '', fallbackLocation].filter(Boolean).join('\n'),
    ),
    location: fallbackLocation || null,
    url: url || 'https://www.google.com/search?q=jobs',
    workMode: inferWorkMode([result.snippet, result.title]),
    employmentType: 'UNKNOWN',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    postedAt: result.date ? new Date(result.date) : null,
    tags: [],
    extraText: null,
  };
}

export class WebSearchProvider implements IJobProvider {
  readonly sourceSlug = 'websearch';
  readonly label = 'Web search (Google Jobs)';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const apiKey = env.SERPER_API_KEY?.trim();
    if (!apiKey) {
      logger.info('[jobs] websearch: SERPER_API_KEY not set — skipping provider');
      return [];
    }
    logger.info(`[jobs] websearch: sync started — ${SEARCH_QUERIES.length} queries`);
    const collected: NormalizedJob[] = [];
    const seen = new Set<string>();
    for (const [index, { query, gl }] of SEARCH_QUERIES.entries()) {
      logger.info(`[jobs] websearch: query ${index + 1}/${SEARCH_QUERIES.length} — "${query}"`);
      try {
        const jobs = await this.searchQuery(apiKey, query, gl);
        logger.info(`[jobs] websearch: "${query}" -> ${jobs.length} job listings`);
        for (const job of jobs) {
          if (job.externalId && seen.has(job.externalId)) continue;
          if (job.externalId) seen.add(job.externalId);
          collected.push(job);
        }
      } catch (error) {
        logger.warn(
          `[jobs] websearch query failed (${query}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    logger.info(`[jobs] websearch: sync finished — ${collected.length} unique jobs`);
    return collected;
  }

  private async searchQuery(apiKey: string, query: string, gl: string): Promise<NormalizedJob[]> {
    const data = (await this.postJson(apiKey, {
      q: query,
      gl,
      hl: 'en',
      num: MAX_PER_QUERY,
    })) as SerperSearchResponse;
    const organic = Array.isArray(data.organic) ? data.organic : [];
    return organic
      .filter((result) => isJobListingUrl(result.link || ''))
      .slice(0, MAX_PER_QUERY)
      .map((result) => toJobResult(result, gl));
  }

  private async postJson(apiKey: string, body: Record<string, unknown>): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(SERPER_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'JobRadar/0.1',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AppError(502, `WebSearch request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      logger.error('WebSearch fetch failed', error);
      throw new AppError(502, 'WebSearch API is unreachable or timed out');
    }
    if (response.status === 429) {
      throw new AppError(502, 'WebSearch rate limit reached (429) — check your Serper quota');
    }
    if (!response.ok) {
      throw new AppError(502, `WebSearch API error (${response.status})`);
    }
    return response.json() as Promise<unknown>;
  }
}