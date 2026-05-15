import { useState } from 'react';

/** Google-style saturated pairs for deterministic gradients */
const GRADIENT_PAIRS: [string, string][] = [
  ['#4285F4', '#AB47BC'],
  ['#EA4335', '#FBBC04'],
  ['#34A853', '#4285F4'],
  ['#FF6D00', '#F4511E'],
  ['#00897B', '#3949AB'],
  ['#6D4C41', '#78909C'],
  ['#C62828', '#AD1457'],
  ['#283593', '#039BE5'],
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
          className={`flex h-full w-full items-center justify-center text-white ${letterClassName}`}
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          <span className="leading-none tracking-tight" aria-hidden>
            {letter}
          </span>
        </div>
      )}
    </div>
  );
}
