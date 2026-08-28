import { apiFetch } from '@/react-app/lib/apiFetch';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import type { ClipPlaybackFailureApiResult } from '@/shared/clip-playback-failure';
import { filterPublicFeedClips, type ClipPlaybackFields } from '@/shared/clip-playback';

export const CLIP_PLAYBACK_SKIPPED_EVENT = 'clip-playback-skipped';

export type ClipPlaybackSkippedDetail = {
  clipId: number;
  hidden: boolean;
  kind: ClipPlaybackFailureApiResult['kind'];
};

const SESSION_SKIP_KEY = 'feedback.skippedUnplayableClips';
const reportedAtByClip = new Map<number, number>();
const REPORT_DEBOUNCE_MS = 15_000;

function readSkippedIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SESSION_SKIP_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    );
  } catch {
    return new Set();
  }
}

function writeSkippedIds(ids: Set<number>): void {
  try {
    sessionStorage.setItem(SESSION_SKIP_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

export function rememberLocallySkippedClip(clipId: number): void {
  if (!Number.isFinite(clipId) || clipId <= 0) return;
  const ids = readSkippedIds();
  ids.add(Math.trunc(clipId));
  writeSkippedIds(ids);
}

export function isLocallySkippedClip(clipId: number | null | undefined): boolean {
  if (clipId == null || !Number.isFinite(clipId) || clipId <= 0) return false;
  return readSkippedIds().has(Math.trunc(clipId));
}

export function clipPlaybackSkippedDetail(event: Event): ClipPlaybackSkippedDetail | null {
  const detail = (event as CustomEvent<Partial<ClipPlaybackSkippedDetail>>).detail;
  const clipId = typeof detail?.clipId === 'number' ? detail.clipId : null;
  if (clipId == null || clipId <= 0) return null;
  return {
    clipId,
    hidden: detail?.hidden === true,
    kind: detail?.kind ?? null,
  };
}

export function dispatchClipPlaybackSkipped(detail: ClipPlaybackSkippedDetail): void {
  rememberLocallySkippedClip(detail.clipId);
  window.dispatchEvent(new CustomEvent(CLIP_PLAYBACK_SKIPPED_EVENT, { detail }));
}

/** Public feeds: worker filter plus clips this device already failed to play. */
export function filterViewerFeedClips<T extends ClipPlaybackFields>(clips: T[]): T[] {
  return filterPublicFeedClips(clips).filter((clip) => {
    const id = clipNumericId(clip);
    return id == null || !isLocallySkippedClip(id);
  });
}

export async function reportClipPlaybackFailure(
  clipId: number,
  mediaErrorCode: number | null,
): Promise<ClipPlaybackFailureApiResult | null> {
  if (!Number.isFinite(clipId) || clipId <= 0) return null;

  const now = Date.now();
  const last = reportedAtByClip.get(clipId) ?? 0;
  if (now - last < REPORT_DEBOUNCE_MS) return null;
  reportedAtByClip.set(clipId, now);

  try {
    const res = await apiFetch(`/api/clips/${clipId}/playback-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaErrorCode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ClipPlaybackFailureApiResult;
    rememberLocallySkippedClip(clipId);
    dispatchClipPlaybackSkipped({
      clipId,
      hidden: Boolean(data.hidden),
      kind: data.kind ?? null,
    });
    return data;
  } catch {
    rememberLocallySkippedClip(clipId);
    dispatchClipPlaybackSkipped({ clipId, hidden: false, kind: null });
    return null;
  }
}
