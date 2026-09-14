import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import {
  getJob,
  getJobStats,
  listJobs,
} from './jobs.service';
import { listJobsQuerySchema } from './jobs.schemas';
import {
  ingestManualJob,
  listActiveSources,
  MIN_SYNC_INTERVAL_MS,
  syncActiveSources,
} from '../../services/jobs/ingest.service';
import type { CreateManualJobInput, ListJobsQuery } from './jobs.schemas';

/** The most recent manual sync, used to throttle "Sync now" requests. */
let lastManualSyncAt: Date | null = null;

export async function list(req: Request, res: Response): Promise<void> {
  const query = listJobsQuerySchema.parse(req.query) as ListJobsQuery;
  const result = await listJobs(query);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const job = await getJob(String(req.params.id));
  res.status(200).json(job);
}

export async function createManual(
  req: Request,
  res: Response,
): Promise<void> {
  const input = req.body as CreateManualJobInput;
  const job = await ingestManualJob({
    title: input.title,
    companyName: input.companyName ?? null,
    description: input.description,
    location: input.location ?? null,
    url: input.url || null,
    workMode: input.workMode,
    employmentType: input.employmentType,
  });
  res.status(201).json(job);
}

export async function sync(_req: Request, res: Response): Promise<void> {
  const now = new Date();
  if (lastManualSyncAt && now.getTime() - lastManualSyncAt.getTime() < MIN_SYNC_INTERVAL_MS) {
    throw new AppError(429, 'Sync is already running — please wait a few minutes before trying again.');
  }
  lastManualSyncAt = now;
  try {
    const summary = await syncActiveSources();
    res.status(200).json(summary);
  } catch (error) {
    // The sync loop is self-guarding, but this guarantees the HTTP request
    // can never hang forever even if something unexpected escapes it.
    lastManualSyncAt = null;
    throw error;
  }
}

export async function sources(_req: Request, res: Response): Promise<void> {
  const result = await listActiveSources();
  res.status(200).json(result);
}

export async function stats(_req: Request, res: Response): Promise<void> {
  const result = await getJobStats();
  res.status(200).json(result);
}