import type { ClipPlaybackTelemetryEvent } from '@/shared/clip-playback-telemetry';

const ENDPOINT = '/api/clips/playback-telemetry';

/** Fire-and-forget. Prefers sendBeacon so swipe-away still lands. */
export function reportClipPlaybackTelemetry(event: ClipPlaybackTelemetryEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(event);
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    /* private mode / full quota */
  }
}
