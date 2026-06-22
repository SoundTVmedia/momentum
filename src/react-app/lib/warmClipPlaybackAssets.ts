import { preconnectStreamDelivery } from '@/shared/clip-playback';
import { warmHlsPlaybackModule } from '@/react-app/components/StreamVideoPlayer';

/** Best-effort CDN + hls.js warmup on app load (feed / modal playback). */
export function warmClipPlaybackAssets(): void {
  if (typeof window === 'undefined') return;
  preconnectStreamDelivery();
  warmHlsPlaybackModule();
}
