import { useEffect, useState } from 'react';
import { Film, Play, X } from 'lucide-react';
import { ADMIN_DEMOS, type AdminDemo } from '@/react-app/lib/admin-demos';

export default function AdminDemosPanel() {
  const [openDemo, setOpenDemo] = useState<AdminDemo | null>(null);

  useEffect(() => {
    if (!openDemo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDemo(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openDemo]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Demos</h2>
        <p className="mt-1 text-gray-400">
          Product walkthroughs from <span className="font-mono text-sm text-gray-300">docs/demos</span>.
          Superadmin only.
        </p>
      </div>

      {ADMIN_DEMOS.length === 0 ? (
        <div className="glass-panel rounded-xl border border-white/10 p-12 text-center">
          <Film className="mx-auto mb-4 h-16 w-16 text-gray-600" />
          <p className="text-gray-400">No demos yet. Add a folder under docs/demos and list it in the catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_DEMOS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => setOpenDemo(demo)}
              className="group glass-panel overflow-hidden rounded-xl border border-white/10 text-left transition-colors hover:border-momentum-ember/40"
            >
              <div className="relative aspect-[9/16] max-h-80 overflow-hidden bg-black">
                <img
                  src={demo.posterSrc}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/20">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-momentum-ember text-white shadow-lg shadow-momentum-ember/40">
                    <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden />
                  </span>
                </div>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {demo.durationLabel}
                </span>
              </div>
              <div className="space-y-1.5 p-4">
                <h3 className="font-headline text-lg font-bold text-white">{demo.title}</h3>
                <p className="text-sm leading-snug text-gray-400">{demo.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {openDemo ? (
        <div
          className="glass-modal-overlay fixed inset-0 z-[80] flex items-center justify-center px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-demo-title"
          onClick={() => setOpenDemo(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h3 id="admin-demo-title" className="min-w-0 truncate font-semibold text-white">
                {openDemo.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenDemo(null)}
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Close demo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <video
              key={openDemo.id}
              src={openDemo.videoSrc}
              poster={openDemo.posterSrc}
              controls
              autoPlay
              playsInline
              className="max-h-[min(80vh,42rem)] w-full bg-black object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
