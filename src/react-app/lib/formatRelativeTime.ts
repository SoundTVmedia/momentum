/** Parse API / DB timestamp values (ISO, SQLite datetime, unix sec/ms). */
export function parseTimestampMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      const ms = n < 1e12 ? n * 1000 : n;
      return Number.isFinite(ms) ? ms : null;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function isUsableTimestamp(value: unknown): boolean {
  return parseTimestampMs(value) != null;
}

/** Prefer upload time (`created_at`), then concert capture time (`timestamp`). */
export function clipPostedAt(clip: { created_at?: unknown; timestamp?: unknown }): unknown {
  if (isUsableTimestamp(clip.created_at)) return clip.created_at;
  if (isUsableTimestamp(clip.timestamp)) return clip.timestamp;
  return clip.created_at ?? clip.timestamp;
}

/** Human-readable relative time; never returns "NaN …". */
export function formatRelativeTime(value: unknown): string {
  const ms = parseTimestampMs(value);
  if (ms == null) return 'Recently';

  const diffMs = Date.now() - ms;
  if (!Number.isFinite(diffMs)) return 'Recently';

  const diffMins = Math.floor(diffMs / 60000);
  if (!Number.isFinite(diffMins)) return 'Recently';

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (!Number.isFinite(diffDays)) return 'Recently';
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
