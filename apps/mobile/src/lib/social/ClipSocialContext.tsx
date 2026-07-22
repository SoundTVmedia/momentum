import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/src/lib/auth/AuthContext';
import {
  fetchLikedClipIds,
  fetchSavedClipIds,
  toggleClipLike,
  toggleClipSave,
} from '@/src/lib/api/social';

type ClipSocialContextValue = {
  likedIds: Set<number>;
  savedIds: Set<number>;
  hydrated: boolean;
  isLiked: (clipId: number) => boolean;
  isSaved: (clipId: number) => boolean;
  toggleLike: (
    clipId: number,
    currentCount: number,
  ) => Promise<{ liked: boolean; likesCount: number }>;
  toggleSave: (clipId: number) => Promise<{ saved: boolean }>;
};

const ClipSocialContext = createContext<ClipSocialContextValue | null>(null);

export function ClipSocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      setSavedIds(new Set());
      setHydrated(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [liked, saved] = await Promise.all([
          fetchLikedClipIds().catch(() => [] as number[]),
          fetchSavedClipIds().catch(() => [] as number[]),
        ]);
        if (cancelled) return;
        setLikedIds(new Set(liked));
        setSavedIds(new Set(saved));
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleLike = useCallback(
    async (clipId: number, currentCount: number) => {
      const wasLiked = likedIds.has(clipId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(clipId);
        else next.add(clipId);
        return next;
      });
      try {
        const result = await toggleClipLike(clipId);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (result.liked) next.add(clipId);
          else next.delete(clipId);
          return next;
        });
        return {
          liked: result.liked,
          likesCount: currentCount + (result.liked === wasLiked ? 0 : result.liked ? 1 : -1),
        };
      } catch {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(clipId);
          else next.delete(clipId);
          return next;
        });
        return { liked: wasLiked, likesCount: currentCount };
      }
    },
    [likedIds],
  );

  const toggleSave = useCallback(
    async (clipId: number) => {
      const wasSaved = savedIds.has(clipId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(clipId);
        else next.add(clipId);
        return next;
      });
      try {
        const result = await toggleClipSave(clipId);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (result.saved) next.add(clipId);
          else next.delete(clipId);
          return next;
        });
        return { saved: result.saved };
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(clipId);
          else next.delete(clipId);
          return next;
        });
        return { saved: wasSaved };
      }
    },
    [savedIds],
  );

  const value = useMemo(
    () => ({
      likedIds,
      savedIds,
      hydrated,
      isLiked: (id: number) => likedIds.has(id),
      isSaved: (id: number) => savedIds.has(id),
      toggleLike,
      toggleSave,
    }),
    [likedIds, savedIds, hydrated, toggleLike, toggleSave],
  );

  return (
    <ClipSocialContext.Provider value={value}>{children}</ClipSocialContext.Provider>
  );
}

export function useClipSocial(): ClipSocialContextValue {
  const ctx = useContext(ClipSocialContext);
  if (!ctx) {
    throw new Error('useClipSocial must be used within ClipSocialProvider');
  }
  return ctx;
}
