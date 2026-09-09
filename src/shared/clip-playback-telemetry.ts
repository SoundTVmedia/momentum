/** Compact client → worker playback sample. Keep keys short; cap string lengths. */
export type ClipPlaybackTelemetryEvent = {
  /** Clip id */
  id: number;
  /** Time-to-first-frame milliseconds */
  ttff: number;
  /** Count of `waiting` stalls after first frame */
  stalls: number;
  /** Sum of stall durations in milliseconds */
  rebuf: number;
  /** Resolved playback URL (truncated) */
  url: string;
  /** Starting rendition, e.g. `hls:360`, `hls`, `mp4`, `r2` */
  rend: string;
  /** Clip duration in seconds */
  dur: number;
};

export const PLAYBACK_TELEMETRY_URL_MAX = 160;
export const PLAYBACK_TELEMETRY_REND_MAX = 24;

export function truncatePlaybackUrl(url: string): string {
  const u = url.trim();
  if (u.length <= PLAYBACK_TELEMETRY_URL_MAX) return u;
  return u.slice(0, PLAYBACK_TELEMETRY_URL_MAX);
}

export function sanitizePlaybackRendition(rend: string): string {
  const r = rend.trim().slice(0, PLAYBACK_TELEMETRY_REND_MAX);
  return r || 'unknown';
}

export function classifyPlaybackRendition(
  url: string,
  hlsHeight: number | null | undefined,
): string {
  if (typeof hlsHeight === 'number' && Number.isFinite(hlsHeight) && hlsHeight > 0) {
    return sanitizePlaybackRendition(`hls:${Math.round(hlsHeight)}`);
  }
  const u = url.trim().toLowerCase();
  if (u.includes('clientbandwidthhint')) return 'hls:hint';
  if (u.includes('.m3u8') || u.includes('/manifest/video.m3u8')) return 'hls';
  if (u.includes('videodelivery.net') || u.includes('cloudflarestream.com')) return 'mp4';
  if (u.includes('/api/files/')) return 'r2';
  if (u.startsWith('blob:')) return 'blob';
  return 'other';
}

export function parsePlaybackTelemetryBody(raw: unknown): ClipPlaybackTelemetryEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  const ttff = Number(o.ttff);
  const stalls = Number(o.stalls);
  const rebuf = Number(o.rebuf);
  const dur = Number(o.dur);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) return null;
  if (!Number.isFinite(ttff) || ttff < 0 || ttff > 120_000) return null;
  if (!Number.isFinite(stalls) || stalls < 0 || stalls > 99) return null;
  if (!Number.isFinite(rebuf) || rebuf < 0 || rebuf > 300_000) return null;
  if (!Number.isFinite(dur) || dur < 0 || dur > 600) return null;
  const url = typeof o.url === 'string' ? truncatePlaybackUrl(o.url) : '';
  const rend =
    typeof o.rend === 'string' ? sanitizePlaybackRendition(o.rend) : 'unknown';
  return {
    id: Math.trunc(id),
    ttff: Math.round(ttff),
    stalls: Math.round(stalls),
    rebuf: Math.round(rebuf),
    url,
    rend,
    dur: Math.round(dur),
  };
}
