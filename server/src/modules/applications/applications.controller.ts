import type { Request, Response } from 'express';
import {
  applicationIdParamSchema,
  interviewIdParamSchema,
  noteIdParamSchema,
} from './applications.schemas';
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

// ------------------------------ Notes ------------------------------

export async function listNotes(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res.status(200).json(await applicationsService.listNotes(req.user!.id, id));
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res
    .status(201)
    .json(await applicationsService.createNote(req.user!.id, id, req.body.body));
}

export async function removeNote(req: Request, res: Response): Promise<void> {
  const { id, noteId } = noteIdParamSchema.parse(req.params);
  await applicationsService.deleteNote(req.user!.id, id, noteId);
  res.status(204).end();
}

// ---------------------------- Interviews ----------------------------

export async function listInterviews(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res.status(200).json(await applicationsService.listInterviews(req.user!.id, id));
}

export async function createInterview(req: Request, res: Response): Promise<void> {
  const { id } = applicationIdParamSchema.parse(req.params);
  res
    .status(201)
    .json(await applicationsService.createInterview(req.user!.id, id, req.body));
}

export async function updateInterview(req: Request, res: Response): Promise<void> {
  const { id, interviewId } = interviewIdParamSchema.parse(req.params);
  res
    .status(200)
    .json(await applicationsService.updateInterview(req.user!.id, id, interviewId, req.body));
}

export async function removeInterview(req: Request, res: Response): Promise<void> {
  const { id, interviewId } = interviewIdParamSchema.parse(req.params);
  await applicationsService.deleteInterview(req.user!.id, id, interviewId);
  res.status(204).end();
}