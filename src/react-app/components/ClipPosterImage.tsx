import type { ImgHTMLAttributes } from 'react';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import { useClipPosterSrc } from '@/react-app/lib/clipPosterImage';
import ClipVideoStill from '@/react-app/components/ClipVideoStill';

export type ClipPosterImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError' | 'onLoad' | 'crossOrigin'
> & {
  clip: ClipPlaybackFields;
};

/** Static clip poster — stored JPEG, Stream still, captured frame, or a paused video frame. */
export default function ClipPosterImage({ clip, alt = '', className = '', ...rest }: ClipPosterImageProps) {
  const { src, probeSrc, videoSrc, onError, onLoad, crossOrigin, cacheExtractedPoster } =
    useClipPosterSrc(clip);

  return (
    <>
      {probeSrc ? (
        <img
          key={`probe-${probeSrc}`}
          src={probeSrc}
          alt=""
          className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
          aria-hidden
          crossOrigin={crossOrigin}
          onError={onError}
          onLoad={onLoad}
        />
      ) : null}
      {src ? (
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
      ) : videoSrc ? (
        <ClipVideoStill src={videoSrc} className={className} onCaptured={cacheExtractedPoster} />
      ) : (
        <div className={`animate-pulse bg-white/10 ${className}`.trim()} aria-hidden />
      )}
    </>
  );
}
