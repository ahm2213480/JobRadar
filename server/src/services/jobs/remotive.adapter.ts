import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, parseSalary, strip, truncateDescription } from './normalize';

const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs?limit=100&sort_by=posting_date';

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  description: string;
  location: string | null;
  url: string;
  salary: string | null;
  published_at: string | null;
  job_type: string | null;
  tags: string[] | null;
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'JobRadar/0.1' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    logger.error('Remotive fetch failed', error);
    throw new AppError(502, 'Remotive API is unreachable or timed out');
  }
  if (!response.ok) {
    throw new AppError(502, `Remotive API error (${response.status})`);
  }
  return response.json();
}

export class RemotiveProvider implements IJobProvider {
  readonly sourceSlug = 'remotive';
  readonly label = 'Remotive';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const data = await getJson(REMOTIVE_URL) as { jobs?: RemotiveJob[] };
    const jobs = data.jobs ?? [];
    return jobs.slice(0, 100).map((job) => {
      const salary = parseSalary(job.salary);
      return {
        externalId: String(job.id),
        title: strip(job.title || 'Untitled role'),
        companyName: strip(job.company_name) || null,
        description: truncateDescription(job.description || ''),
        location: strip(job.location || '') || null,
        url: job.url || `https://remotive.com/remote-jobs/${job.id}`,
        // Remotive lists remote roles only.
        workMode: inferWorkMode([job.location, job.job_type, 'remote']),
        employmentType: 'UNKNOWN',
        salaryMin: salary.salaryMin,
        salaryMax: salary.salaryMax,
        salaryCurrency: salary.salaryCurrency,
        postedAt: job.published_at ? new Date(job.published_at) : null,
        tags: (job.tags ?? []).slice(0, 20).map((tag) => tag.trim()).filter(Boolean),
        extraText: [job.job_type, job.tags?.join(', ')].filter(Boolean).join(' '),
      };
    });
  }
}