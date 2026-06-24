import { mergeSongTitleIntoCaption } from '@/react-app/utils/auddIdentify';

export type AcrClipFieldSnapshot = {
  artist_name?: string | null;
  song_title?: string | null;
  content_description?: string | null;
};

export type AcrClipFieldPatch = {
  song_title?: string;
  artist_name?: string;
  content_description?: string;
};

/** Map an ACR match onto editable clip metadata fields. */
export function acrMatchToClipFieldPatch(
  existing: AcrClipFieldSnapshot,
  match: { artist?: string | null; title?: string | null },
  options?: { overwriteSongTitle?: boolean },
): AcrClipFieldPatch {
  const title = match.title?.trim() ?? '';
  const artist = match.artist?.trim() ?? '';
  if (!title && !artist) return {};

  const patch: AcrClipFieldPatch = {};
  const hasSong = Boolean(existing.song_title?.trim());
  if (title && (options?.overwriteSongTitle !== false || !hasSong)) {
    patch.song_title = title;
    patch.content_description = mergeSongTitleIntoCaption(
      existing.content_description ?? '',
      title,
    );
  }
  if (artist && !existing.artist_name?.trim()) {
    patch.artist_name = artist;
  }
  return patch;
}
