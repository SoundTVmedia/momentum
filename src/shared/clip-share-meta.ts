import { type ClipPlaybackFields, resolveClipPosterUrl } from './clip-playback';
import { resolveClipEventTitle } from './event-title';

export type ClipShareMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
};

export type ClipShareMetaFields = ClipPlaybackFields & {
  content_description?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  event_title?: string | null;
};

export function resolveAppOrigin(origin?: string): string {
  const trimmed = origin?.trim() ?? '';
  if (trimmed) return trimmed.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}

export function toAbsoluteAssetUrl(origin: string, url: string, fallbackPath = '/og-feedback.png'): string {
  const trimmed = url.trim();
  const base = origin.replace(/\/$/, '');
  if (!trimmed) return `${base}${fallbackPath}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function buildClipShareMeta(
  clip: ClipShareMetaFields,
  clipId: number | string,
  origin?: string,
): ClipShareMeta {
  const appOrigin = resolveAppOrigin(origin);
  const id = String(clipId).trim();
  const poster = resolveClipPosterUrl(clip);
  const image = toAbsoluteAssetUrl(appOrigin, poster);

  const artist = typeof clip.artist_name === 'string' ? clip.artist_name.trim() : '';
  const venue = typeof clip.venue_name === 'string' ? clip.venue_name.trim() : '';
  const eventTitle = resolveClipEventTitle({
    event_title: clip.event_title,
    artist_name: clip.artist_name,
    venue_name: clip.venue_name,
  });

  const title = eventTitle
    ? `${eventTitle} on FEEDBACK`
    : artist
      ? `${artist}${venue ? ` at ${venue}` : ''} on FEEDBACK`
      : 'Concert moment on FEEDBACK';

  const description =
    typeof clip.content_description === 'string' && clip.content_description.trim()
      ? clip.content_description.trim()
      : `Watch this live music moment${artist ? ` from ${artist}` : ''}${venue ? ` at ${venue}` : ''} on FEEDBACK.`;

  const url = appOrigin ? `${appOrigin}/?clip=${encodeURIComponent(id)}` : `/?clip=${encodeURIComponent(id)}`;

  return { title, description, image, url };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace default site OG/Twitter tags in `index.html` with clip-specific values. */
export function injectClipShareMetaIntoHtml(html: string, meta: ClipShareMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);

  let next = html;
  next = next.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`,
  );
  next = next.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${description}" />`,
  );
  next = next.replace(
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${image}" />`,
  );
  next = next.replace(
    /<meta[\s\n]*property="og:url"[\s\S]*?\/>/,
    `<meta property="og:url" content="${url}" />`,
  );
  next = next.replace(
    /<meta property="twitter:title" content="[^"]*" \/>/,
    `<meta property="twitter:title" content="${title}" />`,
  );
  next = next.replace(
    /<meta property="twitter:description" content="[^"]*" \/>/,
    `<meta property="twitter:description" content="${description}" />`,
  );
  next = next.replace(
    /<meta property="twitter:image" content="[^"]*" \/>/,
    `<meta property="twitter:image" content="${image}" />`,
  );
  next = next.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  return next;
}

const META_TAG_NAMES = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'twitter:title',
  'twitter:description',
  'twitter:image',
] as const;

function upsertMetaTag(name: string, content: string): void {
  const selector = `meta[property="${name}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Update document meta for in-app share sheets (best-effort; crawlers use server HTML). */
export function applyClipShareMetaToDocument(meta: ClipShareMeta): () => void {
  if (typeof document === 'undefined') return () => {};

  const previousTitle = document.title;
  const previousMeta = new Map<string, string | null>();
  for (const name of META_TAG_NAMES) {
    const el = document.head.querySelector(`meta[property="${name}"]`) as HTMLMetaElement | null;
    previousMeta.set(name, el?.getAttribute('content') ?? null);
  }

  document.title = meta.title;
  for (const name of META_TAG_NAMES) {
    const content =
      name === 'og:title' || name === 'twitter:title'
        ? meta.title
        : name === 'og:description' || name === 'twitter:description'
          ? meta.description
          : name === 'og:image' || name === 'twitter:image'
            ? meta.image
            : meta.url;
    upsertMetaTag(name, content);
  }

  return () => {
    document.title = previousTitle;
    for (const name of META_TAG_NAMES) {
      const prev = previousMeta.get(name);
      if (prev == null) {
        document.head.querySelector(`meta[property="${name}"]`)?.remove();
      } else {
        upsertMetaTag(name, prev);
      }
    }
  };
}
