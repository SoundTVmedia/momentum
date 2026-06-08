import {
  buildClipShareMeta,
  buildMinimalClipShareOgHtml,
  injectClipShareMetaIntoHtml,
  isSocialShareCrawler,
  type ClipShareMetaFields,
} from '../shared/clip-share-meta';

type AssetsBinding = { fetch: typeof fetch };

function resolveWorkerAppOrigin(request: Request, env: Env): string {
  const publicApp =
    typeof env.PUBLIC_APP_URL === 'string' ? env.PUBLIC_APP_URL.trim() : '';
  if (publicApp) return publicApp.replace(/\/$/, '');
  return new URL(request.url).origin.replace(/\/$/, '');
}

function parsePositiveClipId(raw: string | null): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const id = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function ogHtmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

/**
 * For `/?clip=<id>` requests, serve HTML with clip thumbnail + title in OG/Twitter meta
 * so link previews (iMessage, Facebook, X, etc.) show the moment, not the FEEDBACK logo.
 */
export async function maybeServeClipShareOgHtml(
  request: Request,
  env: Env & { ASSETS?: AssetsBinding },
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const url = new URL(request.url);
  if (url.pathname !== '/' && url.pathname !== '/index.html') return null;

  const clipId = parsePositiveClipId(url.searchParams.get('clip'));
  if (clipId == null) return null;

  const row = await env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.id,
      clips.artist_name,
      clips.venue_name,
      clips.event_title,
      clips.content_description,
      clips.thumbnail_url,
      clips.stream_thumbnail_url,
      clips.stream_video_id,
      clips.stream_playback_url,
      clips.video_url
    FROM clips
    WHERE clips.id = ?`,
  )
    .bind(clipId)
    .first();

  if (!row) return null;

  const origin = resolveWorkerAppOrigin(request, env);
  const meta = buildClipShareMeta(row as ClipShareMetaFields, clipId, origin);
  const userAgent = request.headers.get('User-Agent');

  if (isSocialShareCrawler(userAgent)) {
    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
    return ogHtmlResponse(buildMinimalClipShareOgHtml(meta));
  }

  const assets = env.ASSETS;
  if (!assets) return null;

  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  assetUrl.hash = '';

  const assetRequest = new Request(assetUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });
  const assetResponse = await assets.fetch(assetRequest);
  if (!assetResponse.ok) return null;

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: assetResponse.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const html = injectClipShareMetaIntoHtml(await assetResponse.text(), meta);
  return ogHtmlResponse(html);
}
