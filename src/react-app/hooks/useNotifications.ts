import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { apiFetch } from '@/react-app/lib/apiFetch'
import { isNotificationUnread } from '@/react-app/lib/notification-read'

export interface Notification {
  id: number
  mocha_user_id: string
  type: string
  content: string
  related_user_id: string | null
  related_clip_id: number | null
  related_comment_id: number | null
  is_read: number | boolean | string | null
  created_at: string
  user_display_name: string | null
  user_avatar: string | null
}

export const NOTIFICATIONS_CHANGED_EVENT = 'notifications-changed'

function dispatchNotificationsChanged(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
}

function countUnread(rows: Notification[]): number {
  return rows.filter((n) => isNotificationUnread(n.is_read)).length
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!user) return

    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await apiFetch('/api/notifications', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = (await response.json()) as {
        notifications?: Notification[]
        unread_count?: number
      }
      const rows = data.notifications || []
      setNotifications(rows)
      setUnreadCount(
        typeof data.unread_count === 'number'
          ? data.unread_count
          : countUnread(rows),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch notifications:', err)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user])

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }

      const data = (await response.json()) as { unread_count?: number }

      setNotifications((prev) => {
        const next = prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: 1 } : notif,
        )
        setUnreadCount(
          typeof data.unread_count === 'number'
            ? data.unread_count
            : countUnread(next),
        )
        return next
      })

      dispatchNotificationsChanged()
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiFetch('/api/notifications/read-all', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to mark all as read')
      }

      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: 1 })),
      )
      setUnreadCount(0)
      dispatchNotificationsChanged()
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(true)
    
    const interval = setInterval(() => fetchNotifications(false), 15000)
    const onChanged = () => void fetchNotifications(false)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => {
      clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    }
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
    isNotificationUnread,
  }
}
