import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { uploadCvMiddleware } from '../../middleware/upload';
import * as cvController from './cv.controller';

// All CV endpoints belong to the authenticated user only — the userId always
// comes from the access token, never from the request.
const cvRouter = Router();
cvRouter.use(requireAuth);

cvRouter.post('/', uploadCvMiddleware.single('file'), cvController.create);
cvRouter.get('/', cvController.list);
cvRouter.post('/:id/analyze', cvController.analyze);
cvRouter.patch('/:id/primary', cvController.setPrimary);
cvRouter.delete('/:id', cvController.remove);

export default cvRouter;