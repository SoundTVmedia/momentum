export const USER_FAVORITE_TYPES = ['artist', 'venue', 'song', 'archival_show'] as const;

export type UserFavoriteType = (typeof USER_FAVORITE_TYPES)[number];

export type UserFavorite = {
  id: number;
  mocha_user_id: string;
  favorite_type: UserFavoriteType;
  entity_key: string;
  display_name: string | null;
  metadata_json: string | null;
  created_at: string;
};

export function isUserFavoriteType(value: unknown): value is UserFavoriteType {
  return typeof value === 'string' && (USER_FAVORITE_TYPES as readonly string[]).includes(value);
}

export function favoriteEntityKey(type: UserFavoriteType, raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, type === 'song' ? '-' : ' ');
  if (type === 'song') return trimmed.toLowerCase();
  return trimmed;
}
