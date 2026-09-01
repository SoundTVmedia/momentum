import { Browser } from '@capacitor/browser'
import { isNativeApp } from '@/react-app/lib/native-bridge'
import { enterClipPictureInPicture } from '@/react-app/lib/clip-picture-in-picture'

/** Open merch / tickets without killing the clip — PiP first, then the shop. */
export async function openExternalKeepClipPlaying(
  url: string,
  video?: HTMLVideoElement | null,
): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return

  if (video) {
    await enterClipPictureInPicture(video)
  }

  if (isNativeApp()) {
    try {
      await Browser.open({ url: trimmed })
      return
    } catch {
      /* fall through to window.open */
    }
  }

  const opened = window.open(trimmed, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.assign(trimmed)
  }
}
