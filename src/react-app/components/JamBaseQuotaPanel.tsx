import { useEffect, useState } from 'react';
import { Activity, Database } from 'lucide-react';

type MetricsRow = {
  day: string;
  endpoint: string;
  upstream_calls: number;
  cache_hits: number;
};

type MetricsPayload = {
  days: number;
  targetUpstreamPerDay: number;
  today: {
    upstream_calls: number;
    cache_hits: number;
    hit_rate_pct: number | null;
    under_target: boolean;
  };
  window: {
    upstream_calls: number;
    cache_hits: number;
  };
  rows: MetricsRow[];
};

export default function JamBaseQuotaPanel() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/jambase/metrics?days=14');
        if (!response.ok) {
          throw new Error(`Could not load metrics (${response.status})`);
        }
        const json = (await response.json()) as MetricsPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load JamBase metrics');
        }
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
      <div className="glass-panel border border-white/10 rounded-xl p-8 text-center text-gray-400">
        {error ?? 'No JamBase metrics yet. Apply migration 71 and wait for traffic.'}
      </div>
    );
  }

  const todayTotal = data.today.upstream_calls + data.today.cache_hits;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">JamBase API usage</h2>
        <p className="text-gray-400 text-sm">
          Upstream calls vs local cache hits (UTC day). Target is under {data.targetUpstreamPerDay}{' '}
          upstream calls/day in normal operation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Activity className="w-4 h-4" />
            Today upstream
          </div>
          <p className="text-3xl font-bold text-white">{data.today.upstream_calls}</p>
          <p
            className={`text-sm mt-1 ${
              data.today.under_target ? 'text-green-400' : 'text-amber-400'
            }`}
          >
            {data.today.under_target
              ? `Under ${data.targetUpstreamPerDay}/day target`
              : `Over ${data.targetUpstreamPerDay}/day target`}
          </p>
        </div>
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Database className="w-4 h-4" />
            Today cache hits
          </div>
          <p className="text-3xl font-bold text-white">{data.today.cache_hits}</p>
          <p className="text-sm mt-1 text-gray-400">
            {data.today.hit_rate_pct == null
              ? 'No calls recorded yet'
              : `${data.today.hit_rate_pct}% hit rate (${todayTotal} total)`}
          </p>
        </div>
        <div className="glass-panel border border-white/10 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Last {data.days} days</div>
          <p className="text-3xl font-bold text-white">{data.window.upstream_calls}</p>
          <p className="text-sm mt-1 text-gray-400">
            {data.window.cache_hits} cache hits in window
          </p>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-8 text-center text-gray-400">
          No per-endpoint rows yet. Hits and upstream counts appear after the first JamBase
          lookups.
        </div>
      ) : (
        <div className="glass-panel border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="px-4 py-3 font-semibold">Day (UTC)</th>
                <th className="px-4 py-3 font-semibold">Endpoint</th>
                <th className="px-4 py-3 font-semibold text-right">Upstream</th>
                <th className="px-4 py-3 font-semibold text-right">Cache hits</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={`${row.day}:${row.endpoint}`}
                  className="border-b border-white/5 text-white"
                >
                  <td className="px-4 py-2 whitespace-nowrap">{row.day}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-200">{row.endpoint}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.upstream_calls}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.cache_hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
