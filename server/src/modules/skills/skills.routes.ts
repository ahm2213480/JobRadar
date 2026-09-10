import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as skillsController from './skills.controller';
import { createLearningGoalSchema, updateLearningGoalSchema } from './skills.schemas';

// All skills endpoints are authenticated — gap analysis and learning goals
// are always scoped to the requesting user.
const skillsRouter = Router();
skillsRouter.use(requireAuth);

skillsRouter.get('/gap', skillsController.gap);
skillsRouter.get('/learning-goals', skillsController.listGoals);
skillsRouter.post(
  '/learning-goals',
  validateBody(createLearningGoalSchema),
  skillsController.createGoal,
);
skillsRouter.patch(
  '/learning-goals/:id',
  validateBody(updateLearningGoalSchema),
  skillsController.updateGoal,
);
skillsRouter.delete('/learning-goals/:id', skillsController.removeGoal);

export default skillsRouter;