import type { AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import type { ClipMetadataSaveFields } from '@/react-app/lib/applyClipSongRecognition';

export function hashtagsToInput(hashtags: unknown): string {
  if (hashtags == null || hashtags === '') return '';
  if (typeof hashtags === 'string') {
    try {
      const p = JSON.parse(hashtags) as unknown;
      if (Array.isArray(p)) return p.map(String).join(', ');
    } catch {
      return hashtags;
    }
  }
  if (Array.isArray(hashtags)) return hashtags.map(String).join(', ');
  return '';
}

export function metadataFieldsFromClip(clip: {
  artist_name?: unknown;
  venue_name?: unknown;
  location?: unknown;
  content_description?: unknown;
  hashtags?: unknown;
  song_title?: unknown;
  genre_name?: unknown;
}): AcrClipFieldSnapshot & ClipMetadataSaveFields {
  return {
    artist_name: (clip.artist_name as string) ?? '',
    venue_name: (clip.venue_name as string) ?? '',
    location: (clip.location as string) ?? '',
    content_description: (clip.content_description as string) ?? '',
    hashtags: hashtagsToInput(clip.hashtags),
    song_title: (clip.song_title as string) ?? '',
    genre_name: (clip.genre_name as string) ?? '',
  };
}
