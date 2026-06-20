import { clipGeoWhereClause, type SearchGeoAnchor } from './search-geo';

export type SearchUserRow = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  clip_count: number;
};

function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

function prefixLikePattern(query: string): string {
  return `${query.trim()}%`;
}

/** Match Feedback users by profile fields (display name, bio, location, id). */
export async function searchFeedbackUsersByText(
  db: D1Database,
  query: string,
  limit: number,
): Promise<SearchUserRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const like = likePattern(trimmed);
  const prefixLike = prefixLikePattern(trimmed);

  const rows = await db
    .prepare(
      `SELECT
        user_profiles.mocha_user_id,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT clips.id) as clip_count
      FROM user_profiles
      LEFT JOIN clips
        ON user_profiles.mocha_user_id = clips.mocha_user_id
        AND clips.is_hidden = 0
      WHERE (
        user_profiles.display_name LIKE ? COLLATE NOCASE OR
        user_profiles.bio LIKE ? COLLATE NOCASE OR
        user_profiles.location LIKE ? COLLATE NOCASE OR
        user_profiles.city LIKE ? COLLATE NOCASE OR
        user_profiles.mocha_user_id LIKE ?
      )
      GROUP BY user_profiles.mocha_user_id
      ORDER BY
        CASE WHEN user_profiles.display_name LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,
        clip_count DESC,
        user_profiles.display_name ASC
      LIMIT ?`,
    )
    .bind(like, like, like, like, like, prefixLike, limit)
    .all();

  return (rows.results ?? []) as SearchUserRow[];
}

/** Users with clips in a searched area, or whose profile location matches the place. */
export async function searchFeedbackUsersInGeo(
  db: D1Database,
  anchor: SearchGeoAnchor,
  radiusMiles: number,
  limit: number,
): Promise<SearchUserRow[]> {
  const geo = clipGeoWhereClause(anchor, radiusMiles, 'c');
  const tokens = anchor.locationTokens.filter((t) => t.trim().length > 0);

  let profileMatchSql = '0';
  const profileBindings: string[] = [];
  if (tokens.length > 0) {
    profileMatchSql = tokens
      .map(
        () =>
          '(user_profiles.city LIKE ? COLLATE NOCASE OR user_profiles.location LIKE ? COLLATE NOCASE)',
      )
      .join(' OR ');
    for (const token of tokens) {
      const pat = `%${token}%`;
      profileBindings.push(pat, pat);
    }
  }

  const rows = await db
    .prepare(
      `SELECT
        user_profiles.mocha_user_id,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT c.id) as clip_count
      FROM user_profiles
      LEFT JOIN clips c
        ON user_profiles.mocha_user_id = c.mocha_user_id
        AND c.is_hidden = 0
        AND (${geo.sql})
      WHERE c.id IS NOT NULL OR (${profileMatchSql})
      GROUP BY user_profiles.mocha_user_id
      ORDER BY clip_count DESC, user_profiles.display_name ASC
      LIMIT ?`,
    )
    .bind(...geo.bindings, ...profileBindings, limit)
    .all();

  return (rows.results ?? []) as SearchUserRow[];
}
