import type { ImgHTMLAttributes } from 'react';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import { useClipPosterSrc } from '@/react-app/lib/clipPosterImage';

export type ClipPosterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError' | 'onLoad' | 'crossOrigin'
> & {
  clip: ClipPlaybackFields;
};

/** Static clip poster — always from the clip (stored JPEG, Stream still, or captured frame). */
export default function ClipPosterImage({ clip, alt = '', className = '', ...rest }: ClipPosterImageProps) {
  const { src, onError, onLoad, crossOrigin } = useClipPosterSrc(clip);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-white/10 text-[10px] font-medium uppercase tracking-wide text-white/70 ${className}`.trim()}
        aria-hidden
      >
        No preview
      </div>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      crossOrigin={crossOrigin}
      onError={onError}
      onLoad={onLoad}
      {...rest}
    />
  );
}
