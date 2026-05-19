/** Common clip / profile genre labels (slug via `slugifyEntityName`). */
export const CLIP_GENRE_OPTIONS = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'Electronic',
  'R&B',
  'Latin',
  'Jazz',
  'Country',
  'Indie',
  'Metal',
] as const;

export type ClipGenreOption = (typeof CLIP_GENRE_OPTIONS)[number];
