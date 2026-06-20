import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { clearCaptureShowSessionForEvent } from '@/react-app/utils/captureShowSession';
import type { ShowMarkStatus, ShowMarkUpsertInput, UserShowMark } from '@/shared/show-marks';
import {
  partitionShowMarksForLists,
  isActiveShowMarkForCapture,
  showMarkShouldPromoteGoingToAttended,
} from '@/shared/show-marks';

export const SHOW_MARKS_CHANGED_EVENT = 'show-marks-changed';

type ShowMarksSnapshot = {
  marks: UserShowMark[];
  hydrated: boolean;
  loading: boolean;
  userId: string | null;
};

let snapshot: ShowMarksSnapshot = {
  marks: [],
  hydrated: false,
  loading: false,
  userId: null,
};

let fetchPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ShowMarksSnapshot {
  return snapshot;
}

function setSnapshot(next: ShowMarksSnapshot): void {
  snapshot = next;
  emit();
}

function mergeMarkIntoStore(mark: UserShowMark): void {
  const marks = [...snapshot.marks];
  const idx = marks.findIndex((m) => m.jambase_event_id === mark.jambase_event_id);
  if (idx >= 0) marks[idx] = mark;
  else marks.push(mark);
  setSnapshot({ ...snapshot, marks });
}

function removeMarkFromStore(jambaseEventId: string): void {
  setSnapshot({
    ...snapshot,
    marks: snapshot.marks.filter((m) => m.jambase_event_id !== jambaseEventId),
  });
}

function dispatchShowMarksChanged(): void {
  window.dispatchEvent(new CustomEvent(SHOW_MARKS_CHANGED_EVENT));
}

async function fetchMarksShared(userId: string, force = false): Promise<void> {
  if (!force && fetchPromise) {
    await fetchPromise;
    return;
  }

  if (snapshot.userId !== userId) {
    setSnapshot({ marks: [], hydrated: false, loading: false, userId });
  }

  setSnapshot({ ...snapshot, loading: true, userId });

  fetchPromise = (async () => {
    try {
      const res = await apiFetch('/api/users/me/show-marks', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { marks?: UserShowMark[] };
      setSnapshot({
        marks: Array.isArray(data.marks) ? data.marks : [],
        hydrated: true,
        loading: false,
        userId,
      });
    } catch {
      /* ignore */
    } finally {
      setSnapshot({ ...snapshot, loading: false, hydrated: true, userId });
      fetchPromise = null;
    }
  })();

  await fetchPromise;
}

export function useShowMarks() {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!user?.id) {
      setSnapshot({
        marks: [],
        hydrated: true,
        loading: false,
        userId: null,
      });
      return;
    }
    if (store.userId === user.id && store.hydrated) return;
    void fetchMarksShared(user.id);
  }, [user?.id, store.hydrated, store.userId]);

  // Marks are updated optimistically on POST/DELETE — no refetch on change events.

  const marks = user?.id && store.userId === user.id ? store.marks : [];
  const hydrated = !user?.id || (store.userId === user.id && store.hydrated);
  const loading = Boolean(user?.id && store.userId === user.id && store.loading);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSnapshot({ marks: [], hydrated: true, loading: false, userId: null });
      return;
    }
    await fetchMarksShared(user.id, true);
  }, [user?.id]);

  const marksWithEffectiveStatus = useMemo(
    () =>
      marks.map((m) =>
        showMarkShouldPromoteGoingToAttended(m) ? { ...m, status: 'attended' as const } : m,
      ),
    [marks],
  );

  const marksByEventId = useMemo(() => {
    const map = new Map<string, UserShowMark>();
    for (const m of marksWithEffectiveStatus) {
      map.set(m.jambase_event_id, m);
    }
    return map;
  }, [marksWithEffectiveStatus]);

  const listBuckets = useMemo(() => partitionShowMarksForLists(marks), [marks]);

  const goingMarks = listBuckets.going;
  const attendedMarks = listBuckets.attended;

  const captureMarks = useMemo(
    () => marks.filter((m) => isActiveShowMarkForCapture(m)),
    [marks],
  );

  const upsertMark = useCallback(
    async (input: ShowMarkUpsertInput): Promise<boolean> => {
      if (!user) {
        alert('Please sign in to save shows');
        return false;
      }
      try {
        const res = await apiFetch('/api/users/me/show-marks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as { mark?: UserShowMark; error?: string };
        if (!res.ok) {
          const message =
            typeof data.error === 'string' && data.error.trim()
              ? data.error.trim()
              : 'Could not save show mark';
          alert(message);
          return false;
        }
        if (data.mark) {
          mergeMarkIntoStore(data.mark);
        }
        dispatchShowMarksChanged();
        return true;
      } catch {
        return false;
      }
    },
    [user],
  );

  const removeMark = useCallback(
    async (jambaseEventId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const res = await apiFetch(
          `/api/users/me/show-marks/${encodeURIComponent(jambaseEventId)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) return false;
        clearCaptureShowSessionForEvent(jambaseEventId);
        removeMarkFromStore(jambaseEventId);
        dispatchShowMarksChanged();
        return true;
      } catch {
        return false;
      }
    },
    [user],
  );

  const toggleMark = useCallback(
    async (input: ShowMarkUpsertInput): Promise<ShowMarkStatus | null> => {
      const existing = marksByEventId.get(input.jambase_event_id);
      if (existing?.status === input.status) {
        const ok = await removeMark(input.jambase_event_id);
        return ok ? null : existing.status;
      }
      const ok = await upsertMark(input);
      return ok ? input.status : existing?.status ?? null;
    },
    [marksByEventId, removeMark, upsertMark],
  );

  const getMarkForEvent = useCallback(
    (jambaseEventId: string | null | undefined): UserShowMark | null => {
      if (!jambaseEventId?.trim()) return null;
      return marksByEventId.get(jambaseEventId.trim()) ?? null;
    },
    [marksByEventId],
  );

  return {
    marks,
    goingMarks,
    attendedMarks,
    captureMarks,
    marksByEventId,
    hydrated,
    loading,
    refresh,
    toggleMark,
    removeMark,
    getMarkForEvent,
  };
}
