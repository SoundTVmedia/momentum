import { jamBaseEventIsConcluded } from '../shared/jambase-event-day';
import { jamBaseEventId } from '../shared/jambase-events';
import {
  applyStoredSetlistToEvent,
  jamBaseEventSetlist,
  type StoredSetlist,
} from '../shared/jambase-setlist';
import {
  jamBaseShowPageUrl,
  parseJamBaseShowHtmlSetlist,
} from '../shared/jambase-show-html-setlist';
import { upsertCachedEvent } from './jambase-cache';

const JAMBASE_HTML_TIMEOUT_MS = 8_000;
const JAMBASE_HTML_UA =
  'Mozilla/5.0 (compatible; Feedback/1.0; +https://www.jambase.com/) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

export function storedSetlistJson(stored: StoredSetlist): string {
  return JSON.stringify({
    songs: stored.songs,
    url: null,
    htmlChecked: stored.htmlChecked === true,
  });
}

async function fetchJamBaseShowHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': JAMBASE_HTML_UA,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(JAMBASE_HTML_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !/html|xml|text/i.test(contentType)) return null;
    return await res.text();
  } catch (err) {
    console.error('fetchJamBaseShowHtml', url, err);
    return null;
  }
}

export async function loadSetlistFromJamBaseShowHtml(
  ev: Record<string, unknown>,
): Promise<StoredSetlist> {
  const existing = jamBaseEventSetlist(ev);
  if (existing.length > 0) {
    return { songs: existing, url: null, htmlChecked: true };
  }
  if (!jamBaseEventIsConcluded(ev)) {
    return { songs: [], url: null, htmlChecked: false };
  }
  const pageUrl = jamBaseShowPageUrl(ev);
  if (!pageUrl) {
    return { songs: [], url: null, htmlChecked: false };
  }
  const html = await fetchJamBaseShowHtml(pageUrl);
  if (html == null) {
    return { songs: [], url: null, htmlChecked: false };
  }
  const songs = parseJamBaseShowHtmlSetlist(html);
  return { songs, url: null, htmlChecked: true };
}

export async function persistStoredSetlist(
  db: D1Database,
  ev: Record<string, unknown>,
  stored: StoredSetlist,
): Promise<void> {
  const eventId = jamBaseEventId(ev);
  if (!eventId) return;
  const stamped = applyStoredSetlistToEvent(ev, stored);
  const payload = JSON.stringify(stamped);
  const setlistJson = storedSetlistJson(stored);

  await upsertCachedEvent(db, stamped);

  try {
    await db
      .prepare(
        `UPDATE library_shows
         SET setlist_json = ?, payload = ?
         WHERE jambase_event_id = ?`,
      )
      .bind(setlistJson, payload, eventId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/no such table: library_shows/i.test(message)) {
      console.error('persistStoredSetlist library_shows', err);
    }
  }

  try {
    await db
      .prepare(
        `UPDATE jambase_events
         SET setlist_json = ?, payload = ?
         WHERE jambase_event_id = ?`,
      )
      .bind(setlistJson, payload, eventId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/no such column: setlist_json/i.test(message)) {
      console.error('persistStoredSetlist jambase_events', err);
    }
  }
}

export async function eventWithJamBaseHtmlSetlist(
  ev: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const stored = await loadSetlistFromJamBaseShowHtml(ev);
  return applyStoredSetlistToEvent(ev, stored);
}
