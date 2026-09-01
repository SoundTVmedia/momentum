export const APP_PULL_REFRESH_EVENT = 'app-pull-refresh'

export type AppPullRefreshDetail = {
  addTask: (task: Promise<unknown>) => void
}

export function pullRefreshDetail(event: Event): AppPullRefreshDetail | null {
  const detail = (event as CustomEvent<Partial<AppPullRefreshDetail>>).detail
  if (!detail || typeof detail.addTask !== 'function') return null
  return { addTask: detail.addTask }
}

export function dispatchAppPullRefresh(addTask: (task: Promise<unknown>) => void): void {
  window.dispatchEvent(
    new CustomEvent<AppPullRefreshDetail>(APP_PULL_REFRESH_EVENT, {
      detail: { addTask },
    }),
  )
}
