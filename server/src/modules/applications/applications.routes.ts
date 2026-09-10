import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as applicationsController from './applications.controller';
import {
  createApplicationSchema,
  createInterviewSchema,
  createNoteSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
  updateInterviewSchema,
} from './applications.schemas';

// All application endpoints are authenticated — every record is user-scoped.
const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.get('/', applicationsController.list);
applicationsRouter.post('/', validateBody(createApplicationSchema), applicationsController.create);
applicationsRouter.patch(
  '/:id/status',
  validateBody(updateApplicationStatusSchema),
  applicationsController.updateStatus,
);
applicationsRouter.get('/:id', applicationsController.get);
applicationsRouter.patch('/:id', validateBody(updateApplicationSchema), applicationsController.update);
applicationsRouter.delete('/:id', applicationsController.remove);

// Nested notes (ownership verified through the parent application).
applicationsRouter.get('/:id/notes', applicationsController.listNotes);
applicationsRouter.post(
  '/:id/notes',
  validateBody(createNoteSchema),
  applicationsController.createNote,
);
applicationsRouter.delete('/:id/notes/:noteId', applicationsController.removeNote);

// Nested interviews (ownership verified through the parent application).
applicationsRouter.get('/:id/interviews', applicationsController.listInterviews);
applicationsRouter.post(
  '/:id/interviews',
  validateBody(createInterviewSchema),
  applicationsController.createInterview,
);
applicationsRouter.patch(
  '/:id/interviews/:interviewId',
  validateBody(updateInterviewSchema),
  applicationsController.updateInterview,
);
applicationsRouter.delete(
  '/:id/interviews/:interviewId',
  applicationsController.removeInterview,
);

export default applicationsRouter;