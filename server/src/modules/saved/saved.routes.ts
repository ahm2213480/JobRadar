import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as savedController from './saved.controller';

// All saved-jobs endpoints are authenticated — every record is user-scoped.
const savedRouter = Router();
savedRouter.use(requireAuth);

savedRouter.get('/', savedController.list);
savedRouter.post('/:jobId', savedController.save);
savedRouter.get('/:jobId', savedController.status);
savedRouter.delete('/:jobId', savedController.remove);

export default savedRouter;
