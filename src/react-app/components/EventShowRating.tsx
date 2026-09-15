import { useAuth } from '@getmocha/users-service/react';
import { useCallback, useEffect, useState } from 'react';
import StarRating from '@/react-app/components/StarRating';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { SHOW_MARKS_CHANGED_EVENT } from '@/react-app/hooks/useShowMarks';

type ShowRatingState = {
  averageRating: number;
  ratingCount: number;
  userRating: number | null;
  canRate: boolean;
};

const EMPTY: ShowRatingState = {
  averageRating: 0,
  ratingCount: 0,
  userRating: null,
  canRate: false,
};

type EventShowRatingProps = {
  showId: string | null | undefined;
  /** Hide the widget on upcoming / in-progress shows. */
  pastShow?: boolean;
};

export default function EventShowRating({ showId, pastShow = false }: EventShowRatingProps) {
  const { user } = useAuth();
  const id = typeof showId === 'string' ? showId.trim() : '';
  const [state, setState] = useState<ShowRatingState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id || !pastShow) return;
    try {
      const res = await apiFetch(`/api/shows/${encodeURIComponent(id)}/rating`, {
        signal,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<ShowRatingState>;
      if (signal?.aborted) return;
      setState({
        averageRating: Number(data.averageRating) || 0,
        ratingCount: Number(data.ratingCount) || 0,
        userRating: typeof data.userRating === 'number' ? data.userRating : null,
        canRate: data.canRate === true,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Failed to load show rating:', err);
    }
  }, [id, pastShow]);

  useEffect(() => {
    if (!id || !pastShow) return;
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [id, load, user?.id]);

  useEffect(() => {
    const onMarks = () => {
      void load();
    };
    window.addEventListener(SHOW_MARKS_CHANGED_EVENT, onMarks);
    return () => window.removeEventListener(SHOW_MARKS_CHANGED_EVENT, onMarks);
  }, [load]);

  if (!id || !pastShow) return null;

  const handleRate = async (rating: number) => {
    if (!user) {
      alert('Sign in to rate this show.');
      return;
    }
    if (!state.canRate) {
      alert('You can only rate shows after they happen. Mark I went first.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/shows/${encodeURIComponent(id)}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      const data = (await res.json()) as Partial<ShowRatingState> & { error?: string };
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : 'Could not save rating');
        return;
      }
      setState({
        averageRating: Number(data.averageRating) || 0,
        ratingCount: Number(data.ratingCount) || 0,
        userRating: typeof data.userRating === 'number' ? data.userRating : rating,
        canRate: data.canRate !== false,
      });
    } catch (err) {
      console.error('Failed to rate show:', err);
      alert('Could not save rating');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StarRating
      rating={state.userRating}
      averageRating={state.averageRating}
      ratingCount={state.ratingCount}
      onRate={saving ? undefined : handleRate}
      size="md"
      className="items-end"
    />
  );
}
