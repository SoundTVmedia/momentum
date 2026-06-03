import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useNotifications } from '@/react-app/hooks/useNotifications';

type NotificationsContextValue = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Single shared notification state for header badge + panel. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();
  const value = useMemo(
    () => notifications,
    [
      notifications.notifications,
      notifications.unreadNotifications,
      notifications.readNotifications,
      notifications.loading,
      notifications.error,
      notifications.unreadCount,
      notifications.readCount,
      notifications.markAsRead,
      notifications.markAllAsRead,
      notifications.refresh,
      notifications.isNotificationUnread,
    ],
  );
  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within NotificationsProvider');
  }
  return ctx;
}
