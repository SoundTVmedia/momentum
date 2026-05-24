import { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import ClipModal from '@/react-app/components/ClipModal';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { prefetchModalPlayback } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';

type NavState = { selectedClip?: ClipWithUser } | null;

/**
 * Opens `ClipModal` when the URL has `?clip=<id>` or navigation state includes `selectedClip`.
 */
export default function ClipDeepLinkHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [clip, setClip] = useState<ClipWithUser | null>(null);

  const clearClipParam = useCallback(() => {
    if (!searchParams.has('clip')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('clip');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeModal = useCallback(() => {
    setClip(null);
    clearClipParam();
  }, [clearClipParam]);

  useEffect(() => {
    const fromState = (location.state as NavState)?.selectedClip;
    if (fromState && clipNumericId(fromState) != null) {
      setClip(fromState);
      return;
    }
  }, [location.state]);

  useEffect(() => {
    const param = searchParams.get('clip')?.trim();
    if (!param) return;

    const id = Number.parseInt(param, 10);
    if (!Number.isFinite(id) || id <= 0) {
      clearClipParam();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/clips/${id}`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) clearClipParam();
          return;
        }
        const data = (await res.json()) as ClipWithUser;
        if (!cancelled && clipNumericId(data) != null) {
          prefetchModalPlayback(data);
          setClip(data);
        }
      } catch {
        if (!cancelled) clearClipParam();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, clearClipParam]);

  if (!clip) return null;

  return <ClipModal clip={clip} onClose={closeModal} />;
}
