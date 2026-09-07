import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as matchingController from './matching.controller';

// All matching endpoints are authenticated — results are user-scoped.
const matchingRouter = Router();
matchingRouter.use(requireAuth);

matchingRouter.get('/', matchingController.getMatches);
matchingRouter.get('/:jobId', matchingController.getMatchForJob);

export default matchingRouter;