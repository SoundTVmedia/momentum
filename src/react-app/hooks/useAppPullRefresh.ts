import { useEffect } from 'react'
import { APP_PULL_REFRESH_EVENT, pullRefreshDetail } from '@/react-app/lib/app-pull-refresh'

/** Register a data reload that runs when the user pulls to refresh on native. */
export function useAppPullRefresh(
  task: () => void | Promise<unknown>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    const onRefresh = (event: Event) => {
      const detail = pullRefreshDetail(event)
      if (!detail) return
      detail.addTask(Promise.resolve(task()))
    }
    window.addEventListener(APP_PULL_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(APP_PULL_REFRESH_EVENT, onRefresh)
  }, [task, enabled])
}
