import {
  type ClipPlaybackFields,
  resolveClipPosterUrl,
  streamThumbnailUrl,
  streamVideoIdFromClip,
} from './clip-poster-url';
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

/** Share preview image: JamBase artist photo when available, else clip thumbnail. */
export function resolveClipShareImageUrl(
  clip: ClipPlaybackFields,
  origin: string,
  artistImageUrl?: string | null,
): string {
  const artistImg = typeof artistImageUrl === 'string' ? artistImageUrl.trim() : '';
  if (artistImg) {
    return toAbsoluteAssetUrl(origin, artistImg, '');
  }

  const streamId = streamVideoIdFromClip(clip);
  if (streamId) {
    return streamThumbnailUrl(streamId, { height: 720, width: 1280 });
  }
  const poster = resolveClipPosterUrl(clip);
  if (poster.trim()) {
    return toAbsoluteAssetUrl(origin, poster, '');
  }
  return toAbsoluteAssetUrl(origin, '', '/og-feedback.png');
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
  sharePath?: string,
  artistImageUrl?: string | null,
): ClipShareMeta {
  const appOrigin = resolveAppOrigin(origin);
  const id = String(clipId).trim();
  const image = resolveClipShareImageUrl(clip, appOrigin, artistImageUrl);

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

  const path = sharePath ?? `/share/clip/${encodeURIComponent(id)}`;
  const url = appOrigin ? `${appOrigin}${path.startsWith('/') ? path : `/${path}`}` : path;

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
  if (!next.includes('rel="image_src"')) {
    next = next.replace(
      '</head>',
      `    <link rel="image_src" href="${image}" />\n    <meta name="description" content="${description}" />\n    <meta name="twitter:image" content="${image}" />\n    <meta property="og:image:secure_url" content="${image}" />\n  </head>`,
    );
  }
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
    <meta property="og:image:secure_url" content="${image}" />
    <meta property="og:image:type" content="${imageType}" />
    <meta property="og:url" content="${url}" />
    <link rel="image_src" href="${image}" />
    <meta name="description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
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
