import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import ClipModal from '@/react-app/components/ClipModal';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { fetchRelatedClips } from '@/react-app/lib/fetchRelatedClips';
import { prefetchModalPlayback } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';

type NavState = { selectedClip?: ClipWithUser } | null;

/**
 * Opens `ClipModal` when the URL has `?clip=<id>` or navigation state includes `selectedClip`.
 * Loads related clips (same show or artist) so recipients can swipe through more moments.
 */
export default function ClipDeepLinkHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [clip, setClip] = useState<ClipWithUser | null>(null);
  const [feedClips, setFeedClips] = useState<ClipWithUser[] | null>(null);
  const skipParamFetchRef = useRef(false);

  const clearClipParam = useCallback(() => {
    if (!searchParams.has('clip')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('clip');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeModal = useCallback(() => {
    setClip(null);
    setFeedClips(null);
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
    if (!param) {
      setClip(null);
      setFeedClips(null);
      return;
    }

    if (skipParamFetchRef.current) {
      skipParamFetchRef.current = false;
      return;
    }

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
        if (cancelled || clipNumericId(data) == null) return;

        prefetchModalPlayback(data);

        const { clips: related } = await fetchRelatedClips(id);
        const list =
          related.length > 1
            ? related
            : related.length === 1
              ? related
              : [data];

        const anchorId = clipNumericId(data);
        const active =
          list.find((c) => clipNumericId(c) === anchorId) ?? data;

        if (!cancelled) {
          setFeedClips(list.length > 1 ? list : null);
          setClip(active);
          for (const c of list) {
            prefetchModalPlayback(c);
          }
        }
      } catch {
        if (!cancelled) clearClipParam();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, clearClipParam]);

  const handleChangeClip = useCallback(
    (next: ClipWithUser) => {
      setClip(next);
      const nid = clipNumericId(next);
      if (nid == null) return;
      const param = searchParams.get('clip');
      if (param === String(nid)) return;
      skipParamFetchRef.current = true;
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('clip', String(nid));
      setSearchParams(nextParams, { replace: true });
      prefetchModalPlayback(next);
    },
    [searchParams, setSearchParams],
  );

  if (!clip) return null;

  return (
    <ClipModal
      clip={clip}
      onClose={closeModal}
      feedNavigation={
        feedClips && feedClips.length > 1
          ? { clips: feedClips, onChangeClip: handleChangeClip }
          : null
      }
    />
  );
}
