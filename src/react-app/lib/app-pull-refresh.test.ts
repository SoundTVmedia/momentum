import { describe, expect, it, vi } from 'vitest'
import { APP_PULL_REFRESH_EVENT, pullRefreshDetail } from './app-pull-refresh'

describe('pullRefreshDetail', () => {
  it('returns addTask from a pull-refresh event', () => {
    const addTask = vi.fn()
    const event = new CustomEvent(APP_PULL_REFRESH_EVENT, { detail: { addTask } })
    expect(pullRefreshDetail(event)?.addTask).toBe(addTask)
  })

  it('ignores unrelated events', () => {
    expect(pullRefreshDetail(new Event('click'))).toBeNull()
    expect(pullRefreshDetail(new CustomEvent(APP_PULL_REFRESH_EVENT, { detail: {} }))).toBeNull()
  })
})
