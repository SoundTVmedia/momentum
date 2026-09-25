import { afterEach, describe, expect, it, vi } from 'vitest'
import { openExternalKeepClipPlaying } from './open-external-keep-clip-playing'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('openExternalKeepClipPlaying', () => {
  it('opens the shop in a new tab without unloading this page', async () => {
    const opened = { opener: {} } as Window
    const open = vi.fn(() => opened)
    const assign = vi.fn()
    vi.stubGlobal('window', { open, location: { assign } })

    await openExternalKeepClipPlaying('https://tickets.example/show')

    expect(open).toHaveBeenCalledWith('https://tickets.example/show', '_blank')
    expect(opened.opener).toBeNull()
    expect(assign).not.toHaveBeenCalled()
  })

  it('leaves this page only when the new tab is blocked', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { open: vi.fn(() => null), location: { assign } })

    await openExternalKeepClipPlaying('https://shop.example/merch')

    expect(assign).toHaveBeenCalledWith('https://shop.example/merch')
  })
})
