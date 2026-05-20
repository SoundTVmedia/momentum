import { Heart } from 'lucide-react';

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5 sm:h-6 sm:w-6',
  lg: 'h-7 w-7',
} as const;

export type ClipLikeHeartProps = {
  /** Whether the signed-in user has liked this clip. */
  liked: boolean;
  className?: string;
  size?: keyof typeof SIZE_CLASS;
};

/** Consistent like icon: filled red when liked, outline otherwise. */
export function ClipLikeHeart({ liked, className = '', size = 'md' }: ClipLikeHeartProps) {
  const likedClass = liked ? 'fill-current text-red-400' : 'fill-none';
  return (
    <Heart
      className={`${SIZE_CLASS[size]} ${likedClass} ${className}`.trim()}
      aria-hidden
    />
  );
}
