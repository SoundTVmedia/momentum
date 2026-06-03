/** Metadata extracted from an uploaded video file (MP4/MOV/QuickTime). */
export type ExtractedVideoFileMetadata = {
  /** Best-effort capture instant (ISO string). */
  recordedAtIso: string | null;
  recordedAtSource: 'embedded' | 'lastModified' | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: 'embedded' | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  recording_orientation: 'portrait' | 'landscape' | null;
};

/** Seconds from 1904-01-01 UTC (QuickTime / MP4 epoch) → JS Date. */
export function mp4EpochSecondsToDate(seconds: number): Date | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const MS_EPOCH_OFFSET = 2082844800; // 1904 → 1970 UTC
  const ms = (seconds - MS_EPOCH_OFFSET) * 1000;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** ISO 6709 location string e.g. +37.7749-122.4194/ or +37.7749-122.4194+100.0/ */
export function parseIso6709Location(text: string): { latitude: number; longitude: number } | null {
  const m = text.match(/([+-]\d{1,3}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { latitude: lat, longitude: lon };
}

function parseIsoDateString(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Scan binary for UTF-8 date strings common in phone video metadata. */
export function findEmbeddedRecordedAt(bytes: Uint8Array): Date | null {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  const patterns = [
    /creation_time[\x00\s'"=:>]+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/gi,
    /com\.apple\.quicktime\.creationdate[\x00\s'"=:>]+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{4})?)/gi,
    /(?:©day|day)[\x00\s'"=:>]+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{4})?)/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    const hit = re.exec(text);
    if (hit?.[1]) {
      const d = parseIsoDateString(hit[1]);
      if (d) return d;
    }
  }

  return findMvhdCreationDate(bytes);
}

/** Parse `mvhd` / `tkhd` creation_time fields in ISO BMFF. */
export function findMvhdCreationDate(bytes: Uint8Array): Date | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tags = ['mvhd', 'tkhd'] as const;

  for (const tag of tags) {
    for (let i = 0; i <= bytes.length - 24; i++) {
      if (
        bytes[i] === tag.charCodeAt(0) &&
        bytes[i + 1] === tag.charCodeAt(1) &&
        bytes[i + 2] === tag.charCodeAt(2) &&
        bytes[i + 3] === tag.charCodeAt(3)
      ) {
        const version = bytes[i + 8];
        try {
          if (version === 0) {
            const secs = view.getUint32(i + 12, false);
            const d = mp4EpochSecondsToDate(secs);
            if (d) return d;
          } else if (version === 1 && i + 20 <= bytes.length) {
            const hi = view.getUint32(i + 12, false);
            const lo = view.getUint32(i + 16, false);
            const secs = Number((BigInt(hi) << 32n) | BigInt(lo));
            const d = mp4EpochSecondsToDate(secs);
            if (d) return d;
          }
        } catch {
          /* skip malformed atom */
        }
      }
    }
  }
  return null;
}

export function findEmbeddedGps(bytes: Uint8Array): { latitude: number; longitude: number } | null {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  const keys = [
    'com.apple.quicktime.location.ISO6709',
    'ISO6709',
    'location.ISO6709',
    '©xyz',
  ];
  for (const key of keys) {
    const idx = text.indexOf(key);
    if (idx >= 0) {
      const slice = text.slice(idx, idx + 120);
      const loc = parseIso6709Location(slice);
      if (loc) return loc;
    }
  }

  // Fallback: any ISO6709-like coordinate pair in the file header/tail
  const global = text.match(/([+-]\d{1,2}\.\d{3,})([+-]\d{1,3}\.\d{3,})/);
  if (global) {
    const loc = parseIso6709Location(global[0]);
    if (loc) return loc;
  }
  return null;
}

async function readProbeBytes(file: File): Promise<Uint8Array> {
  const HEAD = 512 * 1024;
  const TAIL = 512 * 1024;
  const parts: Uint8Array[] = [];

  const headLen = Math.min(HEAD, file.size);
  parts.push(new Uint8Array(await file.slice(0, headLen).arrayBuffer()));

  if (file.size > headLen) {
    const tailStart = Math.max(headLen, file.size - TAIL);
    parts.push(new Uint8Array(await file.slice(tailStart, file.size).arrayBuffer()));
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function probeVideoElement(file: File): Promise<{
  durationSec: number | null;
  width: number | null;
  height: number | null;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const finish = (result: {
      durationSec: number | null;
      width: number | null;
      height: number | null;
    }) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const timer = window.setTimeout(() => finish({ durationSec: null, width: null, height: null }), 8000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish({
        durationSec: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth > 0 ? video.videoWidth : null,
        height: video.videoHeight > 0 ? video.videoHeight : null,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish({ durationSec: null, width: null, height: null });
    };
    video.src = url;
  });
}

/**
 * Extract GPS, recorded-at, and dimensions from a local video file.
 * Uses embedded QuickTime/MP4 metadata when present; falls back to `File.lastModified`.
 */
export async function extractVideoFileMetadata(file: File): Promise<ExtractedVideoFileMetadata> {
  const [bytes, videoProbe] = await Promise.all([readProbeBytes(file), probeVideoElement(file)]);

  const embeddedAt = findEmbeddedRecordedAt(bytes);
  const embeddedGps = findEmbeddedGps(bytes);

  const lastMod = file.lastModified > 0 ? new Date(file.lastModified) : null;
  const recordedAt = embeddedAt ?? lastMod;
  const recordedAtSource: ExtractedVideoFileMetadata['recordedAtSource'] = embeddedAt
    ? 'embedded'
    : lastMod
      ? 'lastModified'
      : null;

  const w = videoProbe.width;
  const h = videoProbe.height;
  const recording_orientation =
    w != null && h != null ? (h > w ? 'portrait' : 'landscape') : null;

  return {
    recordedAtIso: recordedAt ? recordedAt.toISOString() : null,
    recordedAtSource,
    latitude: embeddedGps?.latitude ?? null,
    longitude: embeddedGps?.longitude ?? null,
    locationSource: embeddedGps ? 'embedded' : null,
    durationSec: videoProbe.durationSec,
    width: w,
    height: h,
    recording_orientation,
  };
}
