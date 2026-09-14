import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, strip, truncateDescription } from './normalize';

// Adzuna — official job-search API, documents:
// https://developer.adzuna.com/docs/search
// URL: https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
// Auth: app_id + app_key query params (server-side only).
// Without keys → []. NOTE: Adzuna covers gb/us/de/fr/... — there is NO
// Jordan (jo) or Saudi/UAE country endpoint, so geo coverage comes from
// JSearch; Adzuna adds Europe/US volume + salary data.

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs';

const SEARCH_TARGETS: Array<{ country: string; what: string; where: string }> = [
  { country: 'gb', what: 'software engineer', where: 'London' },
  { country: 'gb', what: 'developer', where: '' },
  { country: 'de', what: 'software entwickler', where: 'Berlin' },
  { country: 'us', what: 'software engineer', where: '' },
  { country: 'us', what: 'remote developer', where: '' },
];

const MAX_PER_TARGET = 10;

export interface AdzunaJob {
  id?: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  contract_time?: string;
  contract_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  category?: { label?: string };
}

export function mapEmploymentType(contractTime: string | undefined): NormalizedJob['employmentType'] {
  const text = (contractTime ?? '').toLowerCase();
  if (text.includes('full_time')) return 'FULL_TIME';
  if (text.includes('part_time')) return 'PART_TIME';
  return 'UNKNOWN';
}

export class AdzunaProvider implements IJobProvider {
  readonly sourceSlug = 'adzuna';
  readonly label = 'Adzuna';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const appId = env.ADZUNA_APP_ID?.trim();
    const appKey = env.ADZUNA_APP_KEY?.trim();
    if (!appId || !appKey) {
      logger.info('[jobs] adzuna: ADZUNA_APP_ID/ADZUNA_APP_KEY not set — skipping provider');
      return [];
    }
    const collected: NormalizedJob[] = [];
    for (const target of SEARCH_TARGETS) {
      try {
        const jobs = await this.searchTarget(appId, appKey, target);
        logger.info(`[jobs] adzuna: ${target.country}/${target.what} -> ${jobs.length} jobs`);
        collected.push(...jobs);
      } catch (error) {
        logger.warn(
          `[jobs] adzuna query failed (${target.country}/${target.what}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return collected;
  }

  private async searchTarget(
    appId: string,
    appKey: string,
    target: { country: string; what: string; where: string },
  ): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(MAX_PER_TARGET),
      what: target.what,
      ...(target.where ? { where: target.where } : {}),
      max_days_old: '30',
      'content-type': 'application/json',
    });
    const url = `${ADZUNA_BASE}/${target.country}/search/1?${params.toString()}`;
    const data = (await this.getJson(url)) as { results?: AdzunaJob[] };
    const raw = Array.isArray(data.results) ? data.results : [];
    return raw.slice(0, MAX_PER_TARGET).map((job) => this.mapJob(job, target.country));
  }

  mapJob(job: AdzunaJob, country: string): NormalizedJob {
    const location =
      strip(job.location?.display_name || '') ||
      (job.location?.area ?? []).join(', ') ||
      null;
    const description = truncateDescription(job.description ?? '');
    return {
      externalId: job.id ? `adzuna:${country}:${job.id}` : null,
      title: strip(job.title || 'Untitled role'),
      companyName: strip(job.company?.display_name || '') || null,
      description,
      location,
      url: job.redirect_url || 'https://www.adzuna.com/',
      workMode: inferWorkMode([location, description.slice(0, 2000)]),
      employmentType: mapEmploymentType(job.contract_time),
      salaryMin: job.salary_min ?? null,
      salaryMax: job.salary_max ?? null,
      salaryCurrency:
        country === 'gb' ? 'GBP' : country === 'de' ? 'EUR' : country === 'us' ? 'USD' : null,
      postedAt: job.created ? new Date(job.created) : null,
      tags: job.category?.label ? [strip(job.category.label)] : [],
      extraText: [job.contract_type, job.contract_time].filter(Boolean).join(' ') || null,
    };
  }

  private async getJson(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'JobRadar/0.1' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      logger.error('Adzuna fetch failed', error);
      throw new AppError(502, 'Adzuna API is unreachable or timed out');
    }
    if (response.status === 429) {
      throw new AppError(502, 'Adzuna rate limit reached (429) — try again later');
    }
    if (!response.ok) {
      throw new AppError(502, `Adzuna API error (${response.status})`);
    }
    return response.json() as Promise<unknown>;
  }
}
