import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { uploadCvMiddleware } from '../../middleware/upload';
import { optimizeCvSchema } from '../skills/skills.schemas';
import { optimizeCvForJob } from './cv-optimizer.service';
import * as cvController from './cv.controller';

// All CV endpoints belong to the authenticated user only — the userId always
// comes from the access token, never from the request.
const cvRouter = Router();
cvRouter.use(requireAuth);

cvRouter.post('/', uploadCvMiddleware.single('file'), cvController.create);
cvRouter.get('/', cvController.list);
cvRouter.post('/:id/analyze', cvController.analyze);
cvRouter.post(
  '/:id/optimize',
  validateBody(optimizeCvSchema),
  async (req, res, next) => {
    try {
      // Authenticated user only — cvId from the URL, jobId from the body.
      const cvId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      res.status(200).json(await optimizeCvForJob(req.user!.id, cvId, req.body.jobId));
    } catch (error) {
      next(error);
    }
  },
);
cvRouter.patch('/:id/primary', cvController.setPrimary);
cvRouter.delete('/:id', cvController.remove);

export default cvRouter;