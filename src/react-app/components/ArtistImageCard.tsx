import { useEffect, useState } from 'react';
import { displayMediaUrl } from '@/shared/media-proxy';

export const FALLBACK_ARTIST_IMAGE =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop';

type ArtistImageCardProps = {
  name: string;
  imageUrl?: string | null;
  badge?: string | null;
  selected?: boolean;
  onClick: () => void;
};

/** Square artist tile used on festival lineups and Artist Hub. */
export default function ArtistImageCard({
  name,
  imageUrl,
  badge,
  selected = false,
  onClick,
}: ArtistImageCardProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [imageUrl]);

  const src = displayMediaUrl((broken ? '' : imageUrl?.trim()) || FALLBACK_ARTIST_IMAGE);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected || undefined}
      className={`w-full text-left glass-panel border rounded-xl overflow-hidden transition-colors group ${
        selected
          ? 'border-momentum-flare/70 ring-1 ring-momentum-flare/40'
          : 'border-momentum-rose/25 hover:border-momentum-rose/50'
      }`}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => {
            if (!broken && imageUrl?.trim()) setBroken(true);
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {badge ? (
            <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-momentum-flare/90 text-[10px] font-semibold uppercase tracking-wide">
              {badge}
            </span>
          ) : null}
          <div className="text-white font-semibold text-sm truncate">{name}</div>
        </div>
      </div>
    </button>
  );
}
