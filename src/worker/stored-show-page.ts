import {
  applyStoredSetlistToEvent,
  setlistFromStoredEvent,
  type StoredShowPage,
} from '../shared/jambase-setlist';
import { jamBaseShowPageUrl } from '../shared/jambase-show-html-setlist';
import {
  loadSetlistFromJamBaseShowHtml,
  persistStoredSetlist,
} from './jambase-show-html';

function parsePayload(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore malformed cache rows */
  }
  return null;
}

function pageFromRow(
  payloadRaw: string | null | undefined,
  setlistJson: string | null | undefined,
): StoredShowPage | null {
  const payload = parsePayload(payloadRaw);
  if (!payload) return null;
  const stored = setlistFromStoredEvent(setlistJson, payload);
  const event = applyStoredSetlistToEvent(payload, stored);
  return {
    event,
    setlist: stored.songs,
    setlist_url: stored.url,
    htmlChecked: stored.htmlChecked === true,
  };
}

function isMissingColumnOrTable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no such table: library_shows/i.test(message) || /no such column: setlist_json/i.test(message);
}

/**
 * Show-page payload from our tables only — never an upstream JamBase call.
 */
export async function loadStoredShowPage(
  db: D1Database,
  showId: string | null | undefined,
): Promise<StoredShowPage | null> {
  const id = typeof showId === 'string' ? showId.trim() : '';
  if (!id) return null;

  try {
    const stub = await db
      .prepare(
        `SELECT payload, setlist_json
         FROM library_shows
         WHERE jambase_event_id = ?
         LIMIT 1`,
      )
      .bind(id)
      .first<{ payload: string | null; setlist_json: string | null }>();
    const fromStub = pageFromRow(stub?.payload, stub?.setlist_json);
    if (fromStub) return fromStub;
  } catch (err) {
    if (!isMissingColumnOrTable(err)) throw err;
  }

  try {
    const cached = await db
      .prepare(
        `SELECT payload, setlist_json
         FROM jambase_events
         WHERE jambase_event_id = ?
         LIMIT 1`,
      )
      .bind(id)
      .first<{ payload: string | null; setlist_json: string | null }>();
    const fromCache = pageFromRow(cached?.payload, cached?.setlist_json);
    if (fromCache) return fromCache;
  } catch (err) {
    if (!isMissingColumnOrTable(err)) throw err;
    try {
      const cached = await db
        .prepare(
          `SELECT payload
           FROM jambase_events
           WHERE jambase_event_id = ?
           LIMIT 1`,
        )
        .bind(id)
        .first<{ payload: string | null }>();
      const fromCache = pageFromRow(cached?.payload, null);
      if (fromCache) return fromCache;
    } catch (inner) {
      console.error('loadStoredShowPage jambase_events', inner);
    }
  }

  return null;
}

export async function loadOrHydrateStoredShowPage(
  db: D1Database,
  showId: string | null | undefined,
  fetchEvent: () => Promise<Record<string, unknown> | null>,
): Promise<StoredShowPage | null> {
  const stored = await loadStoredShowPage(db, showId);
  if (stored && stored.setlist.length > 0) return stored;
  if (stored && stored.htmlChecked && jamBaseShowPageUrl(stored.event)) return stored;

  const needFetch = !stored || !jamBaseShowPageUrl(stored.event);
  const fetched = needFetch ? await fetchEvent() : null;
  const ev = fetched ?? stored?.event;
  if (!ev) return stored;

  const hydrated = await loadSetlistFromJamBaseShowHtml(ev);
  const event = applyStoredSetlistToEvent(ev, hydrated);
  if (hydrated.htmlChecked) {
    await persistStoredSetlist(db, event, hydrated);
  }
  return {
    event,
    setlist: hydrated.songs,
    setlist_url: null,
    htmlChecked: hydrated.htmlChecked === true,
  };
}
