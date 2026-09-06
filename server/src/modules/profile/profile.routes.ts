import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as profileController from './profile.controller';
import {
  updatePreferencesSchema,
  updateProfileSchema,
} from './profile.schemas';

// All profile routes belong to the authenticated user only — the userId is
// always taken from the access token, never from the request.
const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/', profileController.getBundle);
profileRouter.put(
  '/',
  validateBody(updateProfileSchema),
  profileController.updateProfile,
);
profileRouter.put(
  '/preferences',
  validateBody(updatePreferencesSchema),
  profileController.updatePreferences,
);

export default profileRouter;
