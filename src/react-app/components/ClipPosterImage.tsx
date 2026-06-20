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
export default function ClipPosterImage({ clip, alt = '', ...rest }: ClipPosterImageProps) {
  const { src, onError, onLoad, crossOrigin } = useClipPosterSrc(clip);

  if (!src) return null;

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
