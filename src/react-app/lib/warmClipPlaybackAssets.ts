import { preconnectStreamDelivery } from '@/react-app/lib/clipPlaybackPrefetch';
import { warmHlsPlaybackModule } from '@/react-app/components/StreamVideoPlayer';

/** Best-effort CDN + hls.js warmup on app load (feed / modal playback). */
export function warmClipPlaybackAssets(): void {
  if (typeof window === 'undefined') return;
  preconnectStreamDelivery();
  warmHlsPlaybackModule();
}
