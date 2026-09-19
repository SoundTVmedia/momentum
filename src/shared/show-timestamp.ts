/** Instants before this are Unix-epoch / unset MP4 metadata, not real show nights. */
export const IMPLAUSIBLE_SHOW_TIME_BEFORE_MS = Date.UTC(1971, 0, 1);

export function isPlausibleShowTimeMs(ms: number): boolean {
  return Number.isFinite(ms) && ms >= IMPLAUSIBLE_SHOW_TIME_BEFORE_MS;
}

/**
 * Parse a clip / event timestamp. Rejects empty values and Unix-epoch stand-ins
 * (`0`, `1970-01-01`, Dec 31 1969 local) so callers can fall back to show night.
 */
export function parseShowTimeMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  let ms: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    ms = value < 1e12 ? value * 1000 : value;
  } else {
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      ms = n < 1e12 ? n * 1000 : n;
    } else {
      const parsed = Date.parse(raw);
      ms = Number.isFinite(parsed) ? parsed : null;
    }
  }
  if (ms == null || !isPlausibleShowTimeMs(ms)) return null;
  return ms;
}

/** Storeable ISO for a JamBase start, including date-only `YYYY-MM-DD`. */
export function isoFromEventStart(start: string | null | undefined): string | null {
  const raw = typeof start === 'string' ? start.trim() : '';
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = `${raw}T12:00:00.000Z`;
    return parseShowTimeMs(iso) == null ? null : iso;
  }
  const ms = parseShowTimeMs(raw);
  return ms == null ? null : new Date(ms).toISOString();
}

const FULL_SHOW_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const SHORT_SHOW_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
};

/**
 * Past-show / event card date. Empty and Unix-epoch values render as TBA
 * instead of Wed, Dec 31, 1969. Date-only strings use the UTC calendar day.
 */
export function formatShowCardDate(
  iso?: string | null,
  style: 'full' | 'short' = 'full',
): string {
  const raw = typeof iso === 'string' ? iso.trim() : '';
  if (!raw) return 'Date TBA';
  const options = style === 'short' ? SHORT_SHOW_DATE : FULL_SHOW_DATE;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const d = Number(dateOnly[3]);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    if (!isPlausibleShowTimeMs(dt.getTime())) return 'Date TBA';
    return dt.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
  }
  const ms = parseShowTimeMs(raw);
  if (ms == null) return 'Date TBA';
  return new Date(ms).toLocaleDateString('en-US', options);
}
