import type { Context } from 'hono';
import { DEFAULT_PUBLIC_APP_ORIGIN } from '../shared/media-proxy';

/** Absolute origin used when rewriting JamBase image URLs for Capacitor clients. */
export function clientMediaOrigin(c: Context): string {
  const pub =
    typeof c.env.PUBLIC_APP_URL === 'string' ? c.env.PUBLIC_APP_URL.trim() : '';
  if (pub.startsWith('http://') || pub.startsWith('https://')) {
    return pub.replace(/\/$/, '');
  }
  const reqOrigin = new URL(c.req.url).origin;
  if (reqOrigin.startsWith('http://') || reqOrigin.startsWith('https://')) {
    return reqOrigin;
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}
