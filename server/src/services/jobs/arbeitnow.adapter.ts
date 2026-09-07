import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, strip, truncateDescription } from './normalize';

const ARBEITNOW_URL = 'https://www.arbeitnow.com/api/job-board-api?cities=Berlin,remote&limit=100';

interface ArbeitnowJob {
  id: number;
  title: string;
  company: string;
  description: string;
  location: string[];
  remote: boolean;
  keywords: string[];
  url: string;
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'JobRadar/0.1' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    logger.error('Arbeitnow fetch failed', error);
    throw new AppError(502, 'Arbeitnow API is unreachable');
  }
  if (!response.ok) {
    throw new AppError(502, `Arbeitnow API error (${response.status})`);
  }
  return response.json();
}

export class ArbeitnowProvider implements IJobProvider {
  readonly sourceSlug = 'arbeitnow';
  readonly label = 'Arbeitnow';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const data = await getJson(ARBEITNOW_URL) as { data?: ArbeitnowJob[] };
    const jobs = data.data ?? [];
    return jobs.slice(0, 100).map((job) => {
      const location = Array.isArray(job.location) ? job.location.filter(Boolean).join(', ') : String(job.location ?? '');
      return {
        externalId: String(job.id),
        title: strip(job.title || 'Untitled role'),
        companyName: strip(job.company || '') || null,
        description: truncateDescription(job.description ?? ''),
        location: strip(location) || null,
        url: job.url,
        // Arbeitnow is mostly Germany-based; rely on its remote flag.
        workMode: job.remote
          ? 'REMOTE'
          : inferWorkMode([location]),
        employmentType: 'UNKNOWN',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        postedAt: null,
        tags: (Array.isArray(job.keywords) ? job.keywords : []).slice(0, 20).map((tag) => strip(String(tag))).filter(Boolean),
        extraText: Array.isArray(job.keywords) ? job.keywords.join(', ') : null,
      };
    });
  }
}