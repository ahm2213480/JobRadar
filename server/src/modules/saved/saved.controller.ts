import type { Request, Response } from 'express';
import { savedJobIdParamSchema } from './saved.schemas';
import { isJobSaved, listSavedJobs, saveJob, unsaveJob } from './saved.service';

/**
 * All handlers are mounted behind `requireAuth` — every operation is scoped
 * to `req.user.id`. The client never supplies a user id.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await listSavedJobs(req.user!.id);
  res.status(200).json({ savedJobs: result, total: result.length });
}

export async function save(req: Request, res: Response): Promise<void> {
  const { jobId } = savedJobIdParamSchema.parse(req.params);
  const result = await saveJob(req.user!.id, jobId);
  res.status(201).json(result);
}

export async function status(req: Request, res: Response): Promise<void> {
  const { jobId } = savedJobIdParamSchema.parse(req.params);
  const result = await isJobSaved(req.user!.id, jobId);
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { jobId } = savedJobIdParamSchema.parse(req.params);
  await unsaveJob(req.user!.id, jobId);
  res.status(204).end();
}
