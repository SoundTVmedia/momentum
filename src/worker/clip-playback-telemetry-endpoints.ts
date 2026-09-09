import type { Context } from 'hono';
import { getStaffProfile, isSuperAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';
import {
  playbackDurationBucket,
  PLAYBACK_DURATION_BUCKETS,
  type PlaybackDurationBucket,
} from '../shared/clip-playback';
import { parsePlaybackTelemetryBody } from '../shared/clip-playback-telemetry';

type TelemetryRow = {
  clip_id: number;
  ttff_ms: number;
  stall_count: number;
  rebuffer_ms: number;
  playback_url: string;
  rendition: string;
  duration_sec: number;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1)));
  return sorted[i];
}

function parseJsonBody(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Compact client sample — no auth so swipe-away sendBeacon still lands. */
export async function postClipPlaybackTelemetry(c: Context<{ Bindings: Env }>) {
  let raw: unknown;
  try {
    const text = await c.req.text();
    raw = parseJsonBody(text);
  } catch {
    return c.json({ ok: false }, 400);
  }

  const event = parsePlaybackTelemetryBody(raw);
  if (!event) return c.json({ ok: false }, 400);

  await c.env.DB.prepare(
    `INSERT INTO clip_playback_telemetry
      (clip_id, ttff_ms, stall_count, rebuffer_ms, playback_url, rendition, duration_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(event.id, event.ttff, event.stalls, event.rebuf, event.url, event.rend, event.dur)
    .run();

  if (Math.random() < 0.05) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `DELETE FROM clip_playback_telemetry WHERE created_at < datetime('now', '-14 days')`,
      ).run(),
    );
  }

  return c.json({ ok: true });
}

export async function getPlaybackPerformance(c: Context<{ Bindings: Env }>) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const staffProfile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isSuperAdmin(staffProfile)) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT clip_id, ttff_ms, stall_count, rebuffer_ms, playback_url, rendition, duration_sec
     FROM clip_playback_telemetry
     WHERE created_at >= datetime('now', '-7 days')
     ORDER BY created_at DESC
     LIMIT 8000`,
  ).all<TelemetryRow>();

  const rows = results ?? [];
  const ttffs = rows.map((r) => r.ttff_ms).sort((a, b) => a - b);
  const sampleCount = rows.length;
  const stallPlays = rows.filter((r) => r.stall_count > 0).length;

  const byClip = new Map<
    number,
    { ttffs: number[]; stalls: number; url: string; rend: string; dur: number }
  >();
  for (const row of rows) {
    let entry = byClip.get(row.clip_id);
    if (!entry) {
      entry = { ttffs: [], stalls: 0, url: row.playback_url, rend: row.rendition, dur: row.duration_sec };
      byClip.set(row.clip_id, entry);
    }
    entry.ttffs.push(row.ttff_ms);
    entry.stalls += row.stall_count;
    entry.url = row.playback_url;
    entry.rend = row.rendition;
    entry.dur = row.duration_sec;
  }

  const slowestClips = [...byClip.entries()]
    .map(([clipId, entry]) => {
      const sorted = [...entry.ttffs].sort((a, b) => a - b);
      return {
        clipId,
        samples: sorted.length,
        medianTtffMs: percentile(sorted, 50),
        p90TtffMs: percentile(sorted, 90),
        stallCount: entry.stalls,
        durationSec: entry.dur,
        rendition: entry.rend,
        playbackUrl: entry.url,
      };
    })
    .sort((a, b) => (b.medianTtffMs ?? 0) - (a.medianTtffMs ?? 0))
    .slice(0, 10);

  const byBucket: Record<PlaybackDurationBucket, number[]> = {
    '0-15s': [],
    '15-30s': [],
    '30-45s': [],
    '45-60s': [],
    '60s+': [],
  };
  for (const row of rows) {
    byBucket[playbackDurationBucket(row.duration_sec)].push(row.ttff_ms);
  }

  const ttffByDuration = PLAYBACK_DURATION_BUCKETS.map((bucket) => {
    const values = [...byBucket[bucket]].sort((a, b) => a - b);
    return {
      bucket,
      samples: values.length,
      medianTtffMs: percentile(values, 50),
      p90TtffMs: percentile(values, 90),
    };
  });

  return c.json({
    windowDays: 7,
    sampleCount,
    medianTtffMs: percentile(ttffs, 50),
    p90TtffMs: percentile(ttffs, 90),
    stallRate: sampleCount > 0 ? stallPlays / sampleCount : 0,
    stallPlays,
    slowestClips,
    ttffByDuration,
  });
}
