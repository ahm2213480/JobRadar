import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { loginSchema, registerSchema } from './auth.schemas';
import * as authController from './auth.controller';

const authRouter = Router();

// Tighter limit for credential endpoints only. The generic API limiter still
// applies to everything under /api.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

authRouter.post(
  '/register',
  credentialsLimiter,
  validateBody(registerSchema),
  authController.register,
);
authRouter.post(
  '/login',
  credentialsLimiter,
  validateBody(loginSchema),
  authController.login,
);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);

export default authRouter;
