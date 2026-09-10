import { Router } from 'express';
import applicationsRouter from '../modules/applications/applications.routes';
import authRouter from '../modules/auth/auth.routes';
import cvRouter from '../modules/cv/cv.routes';
import jobsRouter from '../modules/jobs/jobs.routes';
import matchingRouter from '../modules/matching/matching.routes';
import profileRouter from '../modules/profile/profile.routes';
import savedRouter from '../modules/saved/saved.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/cv', cvRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use('/matching', matchingRouter);
apiRouter.use('/saved', savedRouter);
apiRouter.use('/applications', applicationsRouter);
