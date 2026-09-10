import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import type { NotificationItem } from '../types/notification';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listNotifications();
      setNotifications(result.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  async function handleMarkRead(notification: NotificationItem) {
    if (notification.isRead) return;
    setBusyId(notification.id);
    try {
      await api.markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
    } catch {
      // Silently ignore — the list will refresh next time.
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    setBusyId('__all__');
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore — will refresh on next visit.
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Ignore.
    } finally {
      setBusyId(null);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading notifications…
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
              : 'You’re all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" onClick={handleMarkAllRead} disabled={busyId === '__all__'}>
            {busyId === '__all__' ? 'Marking…' : 'Mark all as read'}
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notifications yet"
          message="When new jobs match your profile or your applications change status, you’ll see it here."
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`flex items-start gap-4 px-5 py-4 transition ${
                notification.isRead ? 'opacity-70' : 'bg-blue-50/50 dark:bg-blue-950/20'
              }`}
            >
              <span className="mt-0.5 text-lg">
                {notification.type.includes('job') ? '💼' : '📣'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{notification.title}</p>
                {notification.body && (
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    {notification.body}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {formatTime(notification.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    onClick={() => handleMarkRead(notification)}
                    disabled={busyId === notification.id}
                  >
                    Read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(notification.id)}
                  disabled={busyId === notification.id}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
