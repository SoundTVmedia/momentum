import { jamBaseFetch, jamBaseQuotaFromEnv } from './jambase-client';
import { slugifyEntityName } from '../shared/jambase-slug';
import { toAbsoluteAssetUrl } from '../shared/clip-share-meta';

/** JamBase artist photo for link previews (same source as artist pages). */
export async function resolveClipShareArtistImageUrl(
  env: Env,
  artistName: string | null | undefined,
  origin: string,
): Promise<string | null> {
  const name = typeof artistName === 'string' ? artistName.trim() : '';
  if (!name) return null;

  const slug = slugifyEntityName(name);

  const row = await env.DB.prepare(
    `SELECT image_url FROM artists
     WHERE TRIM(image_url) != ''
     AND (name = ? OR LOWER(REPLACE(TRIM(name), ' ', '-')) = ?)
     LIMIT 1`,
  )
    .bind(name, slug)
    .first<{ image_url: string }>();

  if (row?.image_url?.trim()) {
    return toAbsoluteAssetUrl(origin, row.image_url.trim(), '');
  }

  const apiKey = typeof env.JAMBASE_API_KEY === 'string' ? env.JAMBASE_API_KEY.trim() : '';
  if (!apiKey) return null;

  try {
    const data = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
      apiKey,
      '/artists',
      { artistName: name, perPage: '10', page: '1' },
      jamBaseQuotaFromEnv(env),
    );
    const artists = data?.artists ?? [];
    if (!artists.length) return null;

    const exact = artists.find((a) => slugifyEntityName(String(a.name)) === slug);
    const pick = exact ?? artists[0];
    const img = pick && typeof pick.image === 'string' ? pick.image.trim() : '';
    if (!img) return null;

    return toAbsoluteAssetUrl(origin, img, '');
  } catch (err) {
    console.error('JamBase artist image for clip share failed:', err);
    return null;
  }
}
