import { useEffect, useState } from 'react';
import { Activity, Gauge } from 'lucide-react';

type DurationBucketRow = {
  bucket: string;
  samples: number;
  medianTtffMs: number | null;
  p90TtffMs: number | null;
};

type SlowClip = {
  clipId: number;
  samples: number;
  medianTtffMs: number | null;
  p90TtffMs: number | null;
  stallCount: number;
  durationSec: number;
  rendition: string;
};

type PlaybackPerformanceData = {
  windowDays: number;
  sampleCount: number;
  medianTtffMs: number | null;
  p90TtffMs: number | null;
  stallRate: number;
  stallPlays: number;
  slowestClips: SlowClip[];
  ttffByDuration: DurationBucketRow[];
};

function ms(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)} ms`;
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export default function PlaybackPerformancePanel() {
  const [data, setData] = useState<PlaybackPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/playback-performance', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setError(res.status === 403 ? 'Superadmin only' : 'Failed to load');
          return;
        }
        const json = (await res.json()) as PlaybackPerformanceData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError('Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-momentum-flare border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
        <p className="text-gray-400">{error || 'No playback samples yet'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Playback Performance</h2>
        <p className="text-gray-400 text-sm">
          First-frame and stall samples from the last {data.windowDays} days ({data.sampleCount} plays).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Gauge className="w-4 h-4" />
            Median time-to-first-frame
          </div>
          <p className="text-2xl font-bold text-white">{ms(data.medianTtffMs)}</p>
        </div>
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Gauge className="w-4 h-4" />
            p90 time-to-first-frame
          </div>
          <p className="text-2xl font-bold text-white">{ms(data.p90TtffMs)}</p>
        </div>
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Activity className="w-4 h-4" />
            Stall rate
          </div>
          <p className="text-2xl font-bold text-white">{pct(data.stallRate)}</p>
          <p className="text-xs text-gray-500 mt-1">{data.stallPlays} of {data.sampleCount} plays stalled</p>
        </div>
      </div>

      <div className="glass-panel border border-white/10 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-lg font-semibold text-white mb-3">Time-to-first-frame by clip duration</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/10">
              <th className="py-2 pr-4 font-medium">Duration</th>
              <th className="py-2 pr-4 font-medium">Samples</th>
              <th className="py-2 pr-4 font-medium">Median TTFF</th>
              <th className="py-2 font-medium">p90 TTFF</th>
            </tr>
          </thead>
          <tbody>
            {data.ttffByDuration.map((row) => (
              <tr key={row.bucket} className="border-b border-white/5 text-white">
                <td className="py-2 pr-4">{row.bucket}</td>
                <td className="py-2 pr-4 text-gray-300">{row.samples}</td>
                <td className="py-2 pr-4">{ms(row.medianTtffMs)}</td>
                <td className="py-2">{ms(row.p90TtffMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-panel border border-white/10 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-lg font-semibold text-white mb-3">10 slowest clips</h3>
        {data.slowestClips.length === 0 ? (
          <p className="text-gray-400 text-sm">No samples yet — play clips to populate this list.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Clip ID</th>
                <th className="py-2 pr-4 font-medium">Median TTFF</th>
                <th className="py-2 pr-4 font-medium">p90</th>
                <th className="py-2 pr-4 font-medium">Duration</th>
                <th className="py-2 pr-4 font-medium">Started on</th>
                <th className="py-2 font-medium">Stalls</th>
              </tr>
            </thead>
            <tbody>
              {data.slowestClips.map((clip) => (
                <tr key={clip.clipId} className="border-b border-white/5 text-white">
                  <td className="py-2 pr-4 font-mono">{clip.clipId}</td>
                  <td className="py-2 pr-4">{ms(clip.medianTtffMs)}</td>
                  <td className="py-2 pr-4">{ms(clip.p90TtffMs)}</td>
                  <td className="py-2 pr-4 text-gray-300">
                    {clip.durationSec > 0 ? `${clip.durationSec}s` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{clip.rendition || '—'}</td>
                  <td className="py-2">{clip.stallCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
