import { useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';

const MIN_RADIUS = 10;
const MAX_RADIUS = 200;
const RADIUS_STEP = 10;

type DiscoverSearchGeoBannerProps = {
  label: string;
  radiusMiles: number;
  onRadiusApplied: (radius: number) => void;
};

export default function DiscoverSearchGeoBanner({
  label,
  radiusMiles,
  onRadiusApplied,
}: DiscoverSearchGeoBannerProps) {
  const { user } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draftRadius, setDraftRadius] = useState(radiusMiles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftRadius(radiusMiles);
  }, [radiusMiles]);

  const applyRadius = async () => {
    setSaving(true);
    setError(null);
    try {
      if (user) {
        const res = await apiFetch('/api/personalization/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ location_radius_miles: draftRadius }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          throw new Error(body.detail || body.error || 'Could not save search radius');
        }
      }
      onRadiusApplied(draftRadius);
      setPanelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save search radius');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300 text-sm max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 leading-relaxed">
          Showing results near <span className="text-white font-medium">{label}</span> within{' '}
          <span className="text-white font-medium">{radiusMiles}</span> miles
          {user ? ' — saved to your profile search radius.' : '.'}
        </p>
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="shrink-0 rounded-full border border-momentum-flare/40 bg-momentum-flare/10 px-3 py-1 text-xs font-semibold text-momentum-glacier transition-colors hover:border-momentum-flare/70 hover:bg-momentum-flare/20"
        >
          Change radius
        </button>
      </div>

      {panelOpen ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Search radius: {draftRadius} miles
          </label>
          <input
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={RADIUS_STEP}
            value={draftRadius}
            onChange={(e) => setDraftRadius(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>{MIN_RADIUS} mi</span>
            <span>{MAX_RADIUS} mi</span>
          </div>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void applyRadius()}
              className="rounded-lg px-4 py-2 text-xs font-semibold momentum-grad-interactive text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Apply & refresh'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraftRadius(radiusMiles);
                setPanelOpen(false);
                setError(null);
              }}
              className="rounded-lg px-4 py-2 text-xs font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
