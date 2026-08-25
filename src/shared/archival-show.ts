export const ARCHIVAL_SHOW_ID_PREFIX = 'archival:';

export function isArchivalShowId(eventId: string | null | undefined): boolean {
  return typeof eventId === 'string' && eventId.trim().toLowerCase().startsWith(ARCHIVAL_SHOW_ID_PREFIX);
}

export function newArchivalShowId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${ARCHIVAL_SHOW_ID_PREFIX}${uuid}`;
}

export function archivalShowDateKey(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}
