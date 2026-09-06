import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import profileRouter from '../modules/profile/profile.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
