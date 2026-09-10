import type { Request, Response } from 'express';
import { learningGoalIdParamSchema } from './skills.schemas';
import * as skillsService from './skills.service';

/** All handlers are mounted behind `requireAuth`. */
export async function gap(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await skillsService.computeSkillsGap(_req.user!.id));
}

export async function listGoals(req: Request, res: Response): Promise<void> {
  res.status(200).json(await skillsService.listLearningGoals(req.user!.id));
}

export async function createGoal(req: Request, res: Response): Promise<void> {
  res.status(201).json(await skillsService.createLearningGoal(req.user!.id, req.body));
}

export async function updateGoal(req: Request, res: Response): Promise<void> {
  const { id } = learningGoalIdParamSchema.parse(req.params);
  res.status(200).json(await skillsService.updateLearningGoal(req.user!.id, id, req.body));
}

export async function removeGoal(req: Request, res: Response): Promise<void> {
  const { id } = learningGoalIdParamSchema.parse(req.params);
  await skillsService.deleteLearningGoal(req.user!.id, id);
  res.status(204).end();
}