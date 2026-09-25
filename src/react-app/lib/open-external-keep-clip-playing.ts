import { Browser } from '@capacitor/browser'
import { isNativeApp } from '@/react-app/lib/native-bridge'
import { enterClipPictureInPicture } from '@/react-app/lib/clip-picture-in-picture'

/**
 * Open tickets or merch in a new view without replacing this page.
 * Replacing the page drops picture-in-picture. Call this in the same tap as PiP.
 */
export function openShopWithoutLeavingPlayer(url: string): void {
  const trimmed = url.trim()
  if (!trimmed) return

  if (isNativeApp()) {
    void Browser.open({ url: trimmed })
    return
  }

  const anchor = document.createElement('a')
  anchor.href = trimmed
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

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

  // `noopener` makes window.open return null even when the tab opened, which
  // used to fall through to location.assign and unload this page. Clip <video>
  // PiP survives that; a YouTube document PiP window does not.
  const opened = window.open(trimmed, '_blank')
  if (opened) {
    try {
      opened.opener = null
    } catch {
      /* already severed */
    }
    return
  }
  window.location.assign(trimmed)
}
