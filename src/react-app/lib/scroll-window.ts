/** Instant scroll helpers shared by chrome, PTR, and resource pages. */

export function scrollWindowToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

/**
 * WKWebView / iOS can leave a residual scroll or visualViewport offset after
 * rubber-banding back to the top. Snap to the cold-start origin when the user
 * is already at (or past) the top so header spacing matches launch/refresh.
 */
export function stabilizeWindowTopInset() {
  const y = window.scrollY || document.documentElement.scrollTop || 0
  const vv = window.visualViewport
  const viewportDrift = vv != null && (Math.abs(vv.offsetTop) > 0.5 || Math.abs(vv.pageTop - y) > 0.5)
  if (y <= 0 || (y < 2 && viewportDrift)) {
    scrollWindowToTop()
  }
}
