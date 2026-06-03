import type { Notification } from '@/react-app/hooks/useNotifications'

export function normalizeNotificationId(id: unknown): number | null {
  if (id == null || id === '') return null
  if (typeof id === 'bigint') {
    const n = Number(id)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
  }
  const n = typeof id === 'number' ? id : Number.parseInt(String(id), 10)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function keysForNotification(notification: Pick<Notification, 'id' | 'rowId'>): number[] {
  const keys = new Set<number>()
  const id = normalizeNotificationId(notification.id)
  const rowId = normalizeNotificationId(notification.rowId)
  if (id != null) keys.add(id)
  if (rowId != null) keys.add(rowId)
  return [...keys]
}

/** Primary key sent to the mark-read API (prefer stable `id`). */
export function resolveNotificationKey(
  notification: Pick<Notification, 'id' | 'rowId'>,
): number | null {
  return normalizeNotificationId(notification.id) ?? normalizeNotificationId(notification.rowId)
}

export function notificationKeysMatch(
  a: Pick<Notification, 'id' | 'rowId'>,
  b: Pick<Notification, 'id' | 'rowId'> | number,
): boolean {
  const keysA = keysForNotification(a)
  if (keysA.length === 0) return false

  if (typeof b === 'number') {
    const keyB = normalizeNotificationId(b)
    return keyB != null && keysA.includes(keyB)
  }

  const keysB = keysForNotification(b)
  return keysB.some((key) => keysA.includes(key))
}

export function applyMarkReadToNotifications(
  notifications: Notification[],
  target: Pick<Notification, 'id' | 'rowId'> | number,
): Notification[] {
  return notifications.map((n) =>
    notificationKeysMatch(n, target) ? { ...n, is_read: true as const } : n,
  )
}
