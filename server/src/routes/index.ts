import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
