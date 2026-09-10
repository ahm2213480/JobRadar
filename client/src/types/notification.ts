// ------------------------- Notifications (Phase 10) -------------------------

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unread: number;
}

export interface MarkAllReadResponse {
  updated: number;
}
