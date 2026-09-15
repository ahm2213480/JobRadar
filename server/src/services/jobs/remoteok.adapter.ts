import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import type { IJobProvider, NormalizedJob } from './IJobProvider';
import { inferWorkMode, parseSalary, strip, truncateDescription } from './normalize';

const REMOTEOK_URL = 'https://remoteok.com/api';

interface RemoteOkJob {
  id: string;
  position: string;
  company: string | null;
  description: string;
  location: string | null;
  salary: string | null;
  tags: string[] | null;
  date: number | null;
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
    logger.error('RemoteOK fetch failed', error);
    throw new AppError(502, 'RemoteOK API is unreachable');
  }
  if (!response.ok) {
    throw new AppError(502, `RemoteOK API error (${response.status})`);
  }
  return response.json();
}

/**
 * RemoteOK's `date` field is documented as a unix timestamp but some entries
 * carry strings or garbage — multiplying those yields NaN and `new Date(NaN)`
 * is an Invalid Date, which Prisma rejects outright (killing the whole sync).
 */
function toPostedAt(value: RemoteOkJob['date']): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const parsed = new Date(value * 1000);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class RemoteOkProvider implements IJobProvider {
  readonly sourceSlug = 'remoteok';
  readonly label = 'RemoteOK';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const data = await getJson(REMOTEOK_URL);
    if (!Array.isArray(data)) {
      throw new AppError(502, 'RemoteOK returned an unexpected payload');
    }
    // The API returns a top-level array of jobs plus trailing meta objects —
    // keep only entries that look like real jobs.
    const jobs = (data as unknown[]).filter(
      (item): item is RemoteOkJob =>
        typeof item === 'object' && item !== null && typeof (item as RemoteOkJob).position === 'string',
    );

    return jobs.slice(0, 100).map((job) => {
      const salary = parseSalary(job.salary);
      // RemoteOK URLs have two spaces in some responses.
      const url = (job.url || '').replace(/\s+/g, '').trim();
      return {
        externalId: job.id,
        title: strip(job.position || 'Untitled role'),
        companyName: strip(job.company || '') || null,
        description: truncateDescription(job.description || ''),
        location: strip(job.location || '') || null,
        url: url || `https://remoteok.com/remote-jobs/${job.id}`,
        // RemoteOK lists remote roles only.
        workMode: inferWorkMode([job.location, job.salary, 'remote']),
        employmentType: 'UNKNOWN',
        salaryMin: salary.salaryMin,
        salaryMax: salary.salaryMax,
        salaryCurrency: salary.salaryCurrency,
        postedAt: toPostedAt(job.date),
        tags: (job.tags ?? []).slice(0, 20).map((tag) => strip(String(tag))).filter(Boolean),
        extraText: job.tags?.join(', ') ?? null,
      };
    });
  }
}