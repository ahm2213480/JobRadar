import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listNotifications(userId: string, { unReadOnly = false }: { unReadOnly?: boolean } = {}) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(unReadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Mark a single notification as read (only if it belongs to the user). */
export async function markAsRead(userId: string, id: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new AppError(404, 'Notification not found');
  }
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

/** Mark every notification for this user as read. */
export async function markAllAsRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: count };
}

export async function deleteNotification(userId: string, id: string) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new AppError(404, 'Notification not found');
  }
  await prisma.notification.delete({ where: { id } });
}

/**
 * Helper used by other modules (job sync, matching engine…) to create a
 * notification for a user. Centralised so formatting stays consistent.
 */
export async function createNotification(
  userId: string,
  data: { type: import('@prisma/client').NotificationType; title: string; body?: string | null; data?: unknown },
) {
  return prisma.notification.create({
    data: {
      userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      data: (data.data as object) ?? {},
    },
  });
}
