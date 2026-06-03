import { useState, useEffect, useCallback, useMemo } from 'react'
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

export function normalizeNotificationId(id: unknown): number | null {
  if (id == null || id === '') return null
  if (typeof id === 'bigint') {
    const n = Number(id)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
  }
  const n = typeof id === 'number' ? id : Number.parseInt(String(id), 10)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function dispatchNotificationsChanged(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
}

function countUnread(rows: Notification[]): number {
  return rows.filter((n) => isNotificationUnread(n.is_read)).length
}

function normalizeNotificationRow(row: Record<string, unknown>): Notification | null {
  const id =
    normalizeNotificationId(row.id) ??
    normalizeNotificationId(row._notification_rowid) ??
    normalizeNotificationId((row as { rowid?: unknown }).rowid)
  if (id == null) return null
  const clipId = row.related_clip_id
  const commentId = row.related_comment_id
  return {
    id,
    mocha_user_id: String(row.mocha_user_id ?? ''),
    type: String(row.type ?? ''),
    content: String(row.content ?? ''),
    related_user_id:
      row.related_user_id != null && String(row.related_user_id).length > 0
        ? String(row.related_user_id)
        : null,
    related_clip_id:
      clipId != null && Number.isFinite(Number(clipId)) ? Math.trunc(Number(clipId)) : null,
    related_comment_id:
      commentId != null && Number.isFinite(Number(commentId))
        ? Math.trunc(Number(commentId))
        : null,
    is_read: row.is_read as Notification['is_read'],
    created_at: String(row.created_at ?? ''),
    user_display_name:
      typeof row.user_display_name === 'string' ? row.user_display_name : null,
    user_avatar: typeof row.user_avatar === 'string' ? row.user_avatar : null,
  }
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = useMemo(() => countUnread(notifications), [notifications])

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
        notifications?: Record<string, unknown>[]
      }
      const rows = (data.notifications ?? [])
        .map((row) => normalizeNotificationRow(row))
        .filter((row): row is Notification => row != null)
      setNotifications(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch notifications:', err)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user])

  const markAsRead = useCallback(
    async (notificationId: unknown) => {
      const nid = normalizeNotificationId(notificationId)
      if (nid == null) return

      setNotifications((prev) =>
        prev.map((notif) =>
          normalizeNotificationId(notif.id) === nid ? { ...notif, is_read: 1 } : notif,
        ),
      )

      try {
        const response = await apiFetch(`/api/notifications/${nid}/read`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to mark notification as read')
        }

        await response.json().catch(() => ({}))
        dispatchNotificationsChanged()
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
        void fetchNotifications(false)
      }
    },
    [fetchNotifications],
  )

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: 1 })))

    try {
      const response = await apiFetch('/api/notifications/read-all', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to mark all as read')
      }

      dispatchNotificationsChanged()
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
      void fetchNotifications(false)
    }
  }, [fetchNotifications])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }

    void fetchNotifications(true)

    const interval = setInterval(() => void fetchNotifications(false), 15000)
    const onChanged = () => void fetchNotifications(false)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => {
      clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    }
  }, [user, fetchNotifications])

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
