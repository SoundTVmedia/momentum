import { useEffect, useState } from 'react';
import { countActiveVideos, isPerfDebugEnabled } from '@/react-app/lib/perfDebug';

/** Optional HUD: enable with `localStorage.setItem('momentum:perf-debug', '1')` and reload. */
export default function PerfDebugOverlay() {
  const [stats, setStats] = useState(() => countActiveVideos());

  useEffect(() => {
    if (!isPerfDebugEnabled()) return;
    const tick = () => setStats(countActiveVideos());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!isPerfDebugEnabled()) return null;

  return (
    <div
      className="fixed bottom-2 left-2 z-[9999] rounded-lg bg-black/85 px-2.5 py-1.5 font-mono text-[10px] text-emerald-300 pointer-events-none border border-emerald-500/30"
      aria-hidden
    >
      <div>videos: {stats.mounted} · playing: {stats.playing}</div>
      <div className="text-white/50">perf-debug on</div>
    </div>
  );
}
