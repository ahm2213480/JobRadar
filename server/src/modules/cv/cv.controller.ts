import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import {
  analyzeCv,
  createCv,
  deleteCv,
  listCvs,
  setPrimaryCv,
} from './cv.service';

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new AppError(400, 'No file uploaded (expected multipart field "file")');
  }
  const cv = await createCv(req.user!.id, req.file);
  res.status(201).json(cv);
}

export async function list(req: Request, res: Response): Promise<void> {
  const cvs = await listCvs(req.user!.id);
  res.status(200).json(cvs);
}

export async function analyze(req: Request, res: Response): Promise<void> {
  const result = await analyzeCv(req.user!.id, String(req.params.id));
  res.status(200).json(result);
}

export async function setPrimary(req: Request, res: Response): Promise<void> {
  const cv = await setPrimaryCv(req.user!.id, String(req.params.id));
  res.status(200).json(cv);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteCv(req.user!.id, String(req.params.id));
  res.status(204).send();
}