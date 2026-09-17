import { useState } from 'react';
import { ACTIVE_PALETTE } from '@/react-app/lib/design-palettes';

const { ember, rose, copper, smoke, glacier } = ACTIVE_PALETTE.tokens;

/** Deterministic letter-avatar gradients — Nightstage magenta / violet only. */
const GRADIENT_PAIRS: [string, string][] = [
  [ember, rose],
  [rose, ember],
  [ember, copper],
  [rose, smoke],
  [ember, smoke],
  [rose, copper],
  [copper, rose],
  [smoke, ember],
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function letterFromName(displayName: string | null | undefined): string {
  const t = (displayName ?? '').trim();
  if (!t) return '?';
  const chars = [...t];
  const first = chars[0];
  return first === undefined ? '?' : first.toLocaleUpperCase();
}

export type UserAvatarProps = {
  imageUrl?: string | null;
  displayName?: string | null;
  /** Stable hue when the name is missing (e.g. mocha_user_id) */
  seed?: string | null;
  alt?: string;
  /** Tailwind size classes, e.g. w-10 h-10 */
  sizeClass?: string;
  letterClassName?: string;
  className?: string;
};

export default function UserAvatar({
  imageUrl,
  displayName,
  seed,
  alt,
  sizeClass = 'w-10 h-10',
  letterClassName = 'text-xs font-semibold',
  className = '',
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const url = (imageUrl ?? '').trim();
  const showImg = url.length > 0 && !broken;
  const letter = letterFromName(displayName);
  const gradientSeed = (seed ?? '').trim() || (displayName ?? '').trim() || url || 'user';
  const idx = hashSeed(gradientSeed) % GRADIENT_PAIRS.length;
  const [c1, c2] = GRADIENT_PAIRS[idx];
  const label = alt ?? displayName ?? 'User';

  return (
    <div
      className={`relative inline-flex shrink-0 select-none overflow-hidden rounded-full ${sizeClass} ${className}`}
      role="img"
      aria-label={label}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${letterClassName}`}
          style={{
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            color: glacier,
          }}
        >
          <span className="leading-none tracking-tight" aria-hidden>
            {letter}
          </span>
        </div>
      )}
    </div>
  );
}
