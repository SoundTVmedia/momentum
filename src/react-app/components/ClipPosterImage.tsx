import type { ImgHTMLAttributes } from 'react';
import { type ClipPlaybackFields, DEFAULT_CLIP_POSTER_FALLBACK } from '@/shared/clip-playback';
import { useClipPosterSrc } from '@/react-app/lib/clipPosterImage';

export type ClipPosterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError' | 'onLoad' | 'crossOrigin'
> & {
  clip: ClipPlaybackFields;
  fallback?: string;
};

/** Static clip poster with fallbacks across stored JPEGs and Stream frame times. */
export default function ClipPosterImage({
  clip,
  fallback = DEFAULT_CLIP_POSTER_FALLBACK,
  alt = '',
  ...rest
}: ClipPosterImageProps) {
  const { src, onError, onLoad, crossOrigin } = useClipPosterSrc(clip, fallback);

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      crossOrigin={crossOrigin}
      onError={onError}
      onLoad={onLoad}
      {...rest}
    />
  );
}
