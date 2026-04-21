import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@getmocha/users-service/react'

interface Notification {
  id: number
  mocha_user_id: string
  type: string
  content: string
  related_user_id: string | null
  related_clip_id: number | null
  related_comment_id: number | null
  is_read: number
  created_at: string
  user_display_name: string | null
  user_avatar: string | null
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!user) return

    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()
      setNotifications(data.notifications || [])
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
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      })

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: 1 } : notif
        )
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
      })

      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: 1 }))
      )
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  const unreadCount = notifications.filter((n) => n.is_read === 0).length

  useEffect(() => {
    fetchNotifications(true)
    
    // Poll for new notifications every 15 seconds (background refresh without loading state)
    const interval = setInterval(() => fetchNotifications(false), 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  }
}
