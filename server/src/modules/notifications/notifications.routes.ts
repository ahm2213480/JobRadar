import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './notifications.controller';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', controller.list);
notificationsRouter.get('/unread-count', controller.count);
notificationsRouter.patch('/read-all', controller.markAllRead);
notificationsRouter.patch('/:id/read', controller.markRead);
notificationsRouter.delete('/:id', controller.remove);
