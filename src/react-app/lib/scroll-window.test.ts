import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('scroll-window', () => {
  const scrollTo = vi.fn()
  let documentElementScrollTop = 0
  let bodyScrollTop = 0
  let scrollY = 0
  let visualViewport = { offsetTop: 0, pageTop: 0 }

  beforeEach(async () => {
    scrollTo.mockReset()
    documentElementScrollTop = 0
    bodyScrollTop = 0
    scrollY = 0
    visualViewport = { offsetTop: 0, pageTop: 0 }

    vi.stubGlobal('window', {
      scrollTo,
      get scrollY() {
        return scrollY
      },
      visualViewport,
    })
    vi.stubGlobal('document', {
      documentElement: {
        get scrollTop() {
          return documentElementScrollTop
        },
        set scrollTop(value: number) {
          documentElementScrollTop = value
        },
      },
      body: {
        get scrollTop() {
          return bodyScrollTop
        },
        set scrollTop(value: number) {
          bodyScrollTop = value
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('scrollWindowToTop zeros window and document scroll', async () => {
    documentElementScrollTop = 40
    bodyScrollTop = 12
    const { scrollWindowToTop } = await import('./scroll-window')
    scrollWindowToTop()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    expect(documentElementScrollTop).toBe(0)
    expect(bodyScrollTop).toBe(0)
  })

  it('stabilizeWindowTopInset snaps when scrollY is at or above the top', async () => {
    scrollY = 0
    const { stabilizeWindowTopInset } = await import('./scroll-window')
    stabilizeWindowTopInset()
    expect(scrollTo).toHaveBeenCalled()
  })

  it('stabilizeWindowTopInset ignores mid-page scroll', async () => {
    scrollY = 120
    const { stabilizeWindowTopInset } = await import('./scroll-window')
    stabilizeWindowTopInset()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stabilizeWindowTopInset snaps near top when visualViewport drifted', async () => {
    scrollY = 1
    visualViewport.offsetTop = 47
    visualViewport.pageTop = 1
    // Re-stub so the imported module sees updated visualViewport reference on window
    vi.stubGlobal('window', {
      scrollTo,
      get scrollY() {
        return scrollY
      },
      visualViewport,
    })
    const { stabilizeWindowTopInset } = await import('./scroll-window')
    stabilizeWindowTopInset()
    expect(scrollTo).toHaveBeenCalled()
  })
})
