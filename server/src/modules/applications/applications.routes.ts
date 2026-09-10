import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as applicationsController from './applications.controller';
import {
  createApplicationSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
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

export default applicationsRouter;