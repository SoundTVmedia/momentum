import type { Context } from 'hono';
import { clipMetadataMatchesShow } from '../shared/clip-show-metadata-match';
import { jamBaseEventId } from '../shared/jambase-events';
import { fetchJamBaseEventById } from './jambase-endpoints';
import { jamBaseQuotaFromEnv, normalizeJamBaseApiKey } from './jambase-client';

async function loadEventPayload(
  db: D1Database,
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const id = eventId.trim();
  if (!id) return null;

  const cached = await db
    .prepare(`SELECT payload FROM jambase_events WHERE jambase_event_id = ? LIMIT 1`)
    .bind(id)
    .first<{ payload: string }>();
  if (cached?.payload) {
    try {
      const parsed = JSON.parse(cached.payload) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }

  try {
    const stub = await db
      .prepare(`SELECT payload FROM library_shows WHERE jambase_event_id = ? LIMIT 1`)
      .bind(id)
      .first<{ payload: string | null }>();
    if (stub?.payload) {
      const parsed = JSON.parse(stub.payload) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/no such table: library_shows/i.test(message)) {
      console.error('loadEventPayload library_shows', err);
    }
  }

  return null;
}

export async function rejectIfClipDoesNotMatchTargetShow(
  c: Context<{ Bindings: Env }>,
  input: {
    jambaseEventId: string | null;
    recordedAtIso: string | null;
    latitude: number | null;
    longitude: number | null;
    artistName: string | null;
    venueName: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const eventId = input.jambaseEventId?.trim() || '';
  if (!eventId) return { ok: true };

  let ev = await loadEventPayload(c.env.DB, eventId);
  if (!ev) {
    const key = normalizeJamBaseApiKey(c.env.JAMBASE_API_KEY);
    if (key) {
      try {
        ev = await fetchJamBaseEventById(key, jamBaseQuotaFromEnv(c.env), eventId);
      } catch (err) {
        console.error('rejectIfClipDoesNotMatchTargetShow fetch', err);
      }
    }
  }
  if (!ev) {
    const id = jamBaseEventId({ identifier: eventId });
    ev = {
      identifier: id || eventId,
      startDate: '',
      performer: input.artistName ? [{ name: input.artistName, 'x-isHeadliner': true }] : [],
      location: input.venueName ? { name: input.venueName } : undefined,
    };
  }

  const match = clipMetadataMatchesShow({
    event: ev,
    recordedAtIso: input.recordedAtIso,
    latitude: input.latitude,
    longitude: input.longitude,
    artistName: input.artistName,
    venueName: input.venueName,
  });
  if (!match.ok) return { ok: false, error: match.message };
  return { ok: true };
}
