import { Request, Response } from 'express';
import * as service from './notifications.service';
import { notificationIdParamSchema } from './notifications.schemas';

export async function list(_req: Request, res: Response): Promise<void> {
  const notifications = await service.listNotifications(res.locals.userId);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  res.status(200).json({ notifications, unreadCount });
}

export async function count(_req: Request, res: Response): Promise<void> {
  const unread = await service.getUnreadCount(res.locals.userId);
  res.status(200).json({ unread });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const { id } = notificationIdParamSchema.parse(req.params);
  await service.markAsRead(res.locals.userId, id);
  res.status(204).send();
}

export async function markAllRead(_req: Request, res: Response): Promise<void> {
  const result = await service.markAllAsRead(res.locals.userId);
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = notificationIdParamSchema.parse(req.params);
  await service.deleteNotification(res.locals.userId, id);
  res.status(204).send();
}
