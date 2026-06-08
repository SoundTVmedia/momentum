import { type ClipPlaybackFields, resolveClipPosterUrl } from './clip-poster-url';
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
  return trimmed.replace(/\/$/, '');
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
  next = next.replace(
    /<meta property="og:image:type" content="[^"]*" \/>/,
    `<meta property="og:image:type" content="${meta.image.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'}" />`,
  );
  next = next.replace(
    /<meta property="og:image:width" content="[^"]*" \/>/,
    '',
  );
  next = next.replace(
    /<meta property="og:image:height" content="[^"]*" \/>/,
    '',
  );
  return next;
}

/** Lightweight HTML for social crawlers (no SPA required). */
export function buildMinimalClipShareOgHtml(meta: ClipShareMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  const imageType = meta.image.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="${imageType}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="FEEDBACK" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${image}" />
    <title>${title}</title>
  </head>
  <body>
    <p><a href="${url}">Watch on FEEDBACK</a></p>
  </body>
</html>`;
}

const SOCIAL_CRAWLER_UA =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|applebot|preview|embedly|pinterest|redditbot|vkshare|quora link preview/i;

export function isSocialShareCrawler(userAgent: string | null | undefined): boolean {
  return SOCIAL_CRAWLER_UA.test(userAgent ?? '');
}
