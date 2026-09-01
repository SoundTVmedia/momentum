import { describe, expect, it } from 'vitest'
import { isLikelyTrackpadWheel, trackpadSwipeIntent, wheelDeltaPx } from './clip-trackpad-swipe'

describe('trackpadSwipeIntent', () => {
  it('maps two-finger swipe left (positive deltaX) to next clip', () => {
    expect(trackpadSwipeIntent(80, 10)).toBe('next')
  })

  it('maps two-finger swipe right to previous clip', () => {
    expect(trackpadSwipeIntent(-80, 12)).toBe('prev')
  })

  it('maps two-finger swipe up (positive deltaY) to ticket sheet', () => {
    expect(trackpadSwipeIntent(8, 80)).toBe('up')
  })

  it('ignores a downward trackpad scroll', () => {
    expect(trackpadSwipeIntent(4, -80)).toBeNull()
  })

  it('waits until the flick clears the threshold', () => {
    expect(trackpadSwipeIntent(20, 8)).toBeNull()
  })
})

describe('wheelDeltaPx', () => {
  it('scales line-mode deltas into pixels', () => {
    expect(wheelDeltaPx({ deltaX: 3, deltaY: 0, deltaMode: 1 })).toEqual({ dx: 48, dy: 0 })
  })
})

describe('isLikelyTrackpadWheel', () => {
  it('accepts small pixel-mode deltas from a two-finger flick', () => {
    expect(isLikelyTrackpadWheel({ deltaX: 18, deltaY: 4, deltaMode: 0, ctrlKey: false })).toBe(
      true,
    )
  })

  it('rejects mouse-wheel notches and pinch-zoom', () => {
    expect(isLikelyTrackpadWheel({ deltaX: 0, deltaY: 120, deltaMode: 0, ctrlKey: false })).toBe(
      false,
    )
    expect(isLikelyTrackpadWheel({ deltaX: 3, deltaY: 0, deltaMode: 1, ctrlKey: false })).toBe(
      false,
    )
    expect(isLikelyTrackpadWheel({ deltaX: 0, deltaY: 12, deltaMode: 0, ctrlKey: true })).toBe(
      false,
    )
  })
})
