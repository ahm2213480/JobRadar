import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  id: z.string().min(1, 'Notification ID is required'),
});

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
