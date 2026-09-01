type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (
    mode: 'inline' | 'fullscreen' | 'picture-in-picture',
  ) => boolean
  webkitSetPresentationMode?: (
    mode: 'inline' | 'fullscreen' | 'picture-in-picture',
  ) => void
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture'
}

export function isVideoInPictureInPicture(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false
  if (typeof document !== 'undefined' && document.pictureInPictureElement === video) {
    return true
  }
  const webkit = video as WebkitVideo
  return webkit.webkitPresentationMode === 'picture-in-picture'
}

export async function enterClipPictureInPicture(
  video: HTMLVideoElement | null | undefined,
): Promise<boolean> {
  if (!video) return false
  if (isVideoInPictureInPicture(video)) return true

  try {
    if (video.paused) {
      await video.play()
    }
  } catch {
    /* autoplay / gesture — still try PiP */
  }

  const webkit = video as WebkitVideo
  try {
    if (
      typeof webkit.webkitSetPresentationMode === 'function' &&
      webkit.webkitSupportsPresentationMode?.('picture-in-picture')
    ) {
      webkit.webkitSetPresentationMode('picture-in-picture')
      return true
    }
  } catch {
    /* fall through to standard PiP */
  }

  try {
    if (
      typeof document !== 'undefined' &&
      document.pictureInPictureEnabled &&
      !video.disablePictureInPicture &&
      typeof video.requestPictureInPicture === 'function'
    ) {
      await video.requestPictureInPicture()
      return true
    }
  } catch {
    return false
  }

  return isVideoInPictureInPicture(video)
}

export async function exitClipPictureInPicture(
  video: HTMLVideoElement | null | undefined,
): Promise<void> {
  if (!video) return
  const webkit = video as WebkitVideo
  try {
    if (
      webkit.webkitPresentationMode === 'picture-in-picture' &&
      typeof webkit.webkitSetPresentationMode === 'function'
    ) {
      webkit.webkitSetPresentationMode('inline')
      return
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof document !== 'undefined' && document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
    }
  } catch {
    /* ignore */
  }
}
