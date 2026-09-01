import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enterClipPictureInPicture,
  isVideoInPictureInPicture,
} from './clip-picture-in-picture'

function mockVideo(overrides: Record<string, unknown> = {}): HTMLVideoElement {
  return {
    paused: false,
    disablePictureInPicture: false,
    play: vi.fn().mockResolvedValue(undefined),
    requestPictureInPicture: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HTMLVideoElement
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enterClipPictureInPicture', () => {
  it('uses iOS webkit presentation mode when available', async () => {
    const setMode = vi.fn()
    const video = mockVideo({
      webkitSupportsPresentationMode: (mode: string) => mode === 'picture-in-picture',
      webkitSetPresentationMode: setMode,
      webkitPresentationMode: 'inline',
    })
    setMode.mockImplementation((mode: string) => {
      ;(video as { webkitPresentationMode: string }).webkitPresentationMode = mode
    })

    await expect(enterClipPictureInPicture(video)).resolves.toBe(true)
    expect(setMode).toHaveBeenCalledWith('picture-in-picture')
  })

  it('falls back to standard requestPictureInPicture', async () => {
    const video = mockVideo()
    vi.stubGlobal('document', {
      pictureInPictureEnabled: true,
      pictureInPictureElement: null,
    })
    await expect(enterClipPictureInPicture(video)).resolves.toBe(true)
    expect(video.requestPictureInPicture).toHaveBeenCalled()
  })
})

describe('isVideoInPictureInPicture', () => {
  it('detects webkit picture-in-picture mode', () => {
    const video = mockVideo({ webkitPresentationMode: 'picture-in-picture' })
    expect(isVideoInPictureInPicture(video)).toBe(true)
  })
})
