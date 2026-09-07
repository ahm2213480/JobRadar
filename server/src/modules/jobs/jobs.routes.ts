import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as jobsController from './jobs.controller';
import { createManualJobSchema } from './jobs.schemas';

// All jobs endpoints are authenticated — the data is user-scoped and the
// sync endpoint hits external APIs that must be rate-limited per user.
const jobsRouter = Router();
jobsRouter.use(requireAuth);

jobsRouter.get('/', jobsController.list);
jobsRouter.get('/stats', jobsController.stats);
jobsRouter.get('/sources', jobsController.sources);
jobsRouter.post('/sync', jobsController.sync);
jobsRouter.post(
  '/manual',
  validateBody(createManualJobSchema),
  jobsController.createManual,
);
jobsRouter.get('/:id', jobsController.getById);

export default jobsRouter;