import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import type { ShowMarkStatus, ShowMarkUpsertInput, UserShowMark } from '@/shared/show-marks';

export const SHOW_MARKS_CHANGED_EVENT = 'show-marks-changed';

function dispatchShowMarksChanged(): void {
  window.dispatchEvent(new CustomEvent(SHOW_MARKS_CHANGED_EVENT));
}

export function useShowMarks() {
  const { user } = useAuth();
  const [marks, setMarks] = useState<UserShowMark[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setMarks([]);
      setHydrated(true);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/users/me/show-marks', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { marks?: UserShowMark[] };
      setMarks(Array.isArray(data.marks) ? data.marks : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(SHOW_MARKS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHOW_MARKS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const marksByEventId = useMemo(() => {
    const map = new Map<string, UserShowMark>();
    for (const m of marks) {
      map.set(m.jambase_event_id, m);
    }
    return map;
  }, [marks]);

  const goingMarks = useMemo(
    () => marks.filter((m) => m.status === 'going'),
    [marks],
  );

  const attendedMarks = useMemo(
    () => marks.filter((m) => m.status === 'attended'),
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
        if (!res.ok) return false;
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
    marksByEventId,
    hydrated,
    loading,
    refresh,
    toggleMark,
    removeMark,
    getMarkForEvent,
  };
}
