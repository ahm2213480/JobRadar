import type { Request, Response } from 'express';
import { applicationIdParamSchema } from './applications.schemas';
import * as applicationsService from './applications.service';

/**
 * All handlers are mounted behind `requireAuth` — every operation is scoped to
 * `req.user.id`. The client never supplies a user id.
 */
export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(await applicationsService.listApplications(req.user!.id));
}

export async function get(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res.status(200).json(await applicationsService.getApplication(req.user!.id, id));
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(await applicationsService.createApplication(req.user!.id, req.body));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res.status(200).json(await applicationsService.updateApplication(req.user!.id, id, req.body));
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res
    .status(200)
    .json(await applicationsService.updateApplicationStatus(req.user!.id, id, req.body.status));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  await applicationsService.deleteApplication(req.user!.id, id);
  res.status(204).end();
}