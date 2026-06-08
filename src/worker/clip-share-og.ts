import {
  buildClipShareMeta,
  buildMinimalClipShareOgHtml,
  injectClipShareMetaIntoHtml,
  type ClipShareMetaFields,
} from '../shared/clip-share-meta';

type AssetsBinding = { fetch: typeof fetch };

const CLIP_SHARE_SELECT = `SELECT
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
WHERE clips.id = ?`;

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

function clipIdFromShareRequest(url: URL): number | null {
  const shareMatch = /^\/share\/clip\/([^/]+)\/?$/.exec(url.pathname);
  if (shareMatch) {
    return parsePositiveClipId(decodeURIComponent(shareMatch[1]));
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return parsePositiveClipId(url.searchParams.get('clip'));
  }
  return null;
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

async function fetchClipShareRow(env: Env, clipId: number) {
  return env.DB.prepare(CLIP_SHARE_SELECT).bind(clipId).first();
}

async function buildInjectedShareHtml(
  request: Request,
  env: Env & { ASSETS?: AssetsBinding },
  meta: ReturnType<typeof buildClipShareMeta>,
): Promise<string | null> {
  const assets = env.ASSETS;
  if (!assets) return null;

  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  assetUrl.hash = '';

  const assetResponse = await assets.fetch(
    new Request(assetUrl.toString(), { method: 'GET', headers: request.headers }),
  );
  if (!assetResponse.ok) return null;

  return injectClipShareMetaIntoHtml(await assetResponse.text(), meta);
}

/**
 * Serve HTML with clip thumbnail in OG/Twitter meta for share + deep-link URLs.
 * `/share/clip/:id` — primary share URL (never matches a static asset).
 * `/?clip=:id` — legacy deep links (worker must run before static index.html).
 */
export async function maybeServeClipShareOgHtml(
  request: Request,
  env: Env & { ASSETS?: AssetsBinding },
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const url = new URL(request.url);
  const clipId = clipIdFromShareRequest(url);
  if (clipId == null) return null;

  const row = await fetchClipShareRow(env, clipId);
  if (!row) return null;

  const origin = resolveWorkerAppOrigin(request, env);
  const sharePath = url.pathname.startsWith('/share/clip/')
    ? url.pathname.replace(/\/$/, '') || `/share/clip/${clipId}`
    : `/share/clip/${clipId}`;
  const meta = buildClipShareMeta(row as ClipShareMetaFields, clipId, origin, sharePath);

  const injected = await buildInjectedShareHtml(request, env, meta);
  const html = injected ?? buildMinimalClipShareOgHtml(meta);

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  return ogHtmlResponse(html);
}
