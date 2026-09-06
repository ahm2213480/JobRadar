import type { Request, Response } from 'express';
import {
  getProfileBundle,
  upsertPreferences,
  upsertProfile,
} from './profile.service';
import type {
  UpdatePreferencesInput,
  UpdateProfileInput,
} from './profile.schemas';

/**
 * Every handler re-reads the full bundle after a write so the client always
 * receives fresh completion data together with the saved values.
 */
export async function getBundle(req: Request, res: Response): Promise<void> {
  const bundle = await getProfileBundle(req.user!.id);
  res.status(200).json(bundle);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  await upsertProfile(req.user!.id, req.body as UpdateProfileInput);
  const bundle = await getProfileBundle(req.user!.id);
  res.status(200).json(bundle);
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  await upsertPreferences(req.user!.id, req.body as UpdatePreferencesInput);
  const bundle = await getProfileBundle(req.user!.id);
  res.status(200).json(bundle);
}
