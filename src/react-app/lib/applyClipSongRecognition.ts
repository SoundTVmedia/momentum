import { acrMatchToClipFieldPatch, type AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { identifySongForUploadedClip } from '@/react-app/lib/identifySongForUploadedClip';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import type { ClipWithUser } from '@/shared/types';
import {
  isFatalSongIdentifyError,
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';

export type ClipMetadataSaveFields = {
  artist_name: string;
  venue_name: string;
  location: string;
  content_description: string;
  hashtags: string;
  song_title: string;
  genre_name: string;
};

export async function saveClipMetadataFields(
  clip: ClipPlaybackFields,
  fields: ClipMetadataSaveFields,
  options?: { asSuperadmin?: boolean },
): Promise<ClipWithUser> {
  const clipId = clipNumericId(clip);
  const streamVideoId =
    typeof clip.stream_video_id === 'string' ? clip.stream_video_id.trim() : '';
  if (clipId == null && !streamVideoId) {
    throw new Error('Invalid clip');
  }

  const payload: Record<string, unknown> = { ...fields };
  if (clipId != null) payload.clipId = clipId;
  if (streamVideoId) payload.streamVideoId = streamVideoId;

  const endpoint = options?.asSuperadmin
    ? '/api/admin/clips/update-metadata'
    : '/api/clips/update-own';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let msg = 'Could not save changes';
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await response.json()) as ClipWithUser;
}

export type ClipSongRecognitionOutcome =
  | { status: 'match'; message: string; updated: ClipWithUser; result: AudDIdentifyResult }
  | { status: 'nomatch' | 'skipped' | 'error'; message: string; result: AudDIdentifyResult };

export async function runClipSongRecognitionAndSave(input: {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
}): Promise<ClipSongRecognitionOutcome> {
  const result = normalizeIdentifyResult(await identifySongForUploadedClip(input.clip));

  if (result.status === 'match') {
    const patch = acrMatchToClipFieldPatch(input.currentFields, result, {
      overwriteSongTitle: true,
    });
    const nextFields: ClipMetadataSaveFields = {
      artist_name: patch.artist_name ?? input.currentFields.artist_name ?? '',
      venue_name: input.currentFields.venue_name ?? '',
      location: input.currentFields.location ?? '',
      content_description: patch.content_description ?? input.currentFields.content_description ?? '',
      hashtags: input.currentFields.hashtags ?? '',
      song_title: patch.song_title ?? input.currentFields.song_title ?? '',
      genre_name: input.currentFields.genre_name ?? '',
    };
    const updated = await saveClipMetadataFields(input.clip, nextFields, {
      asSuperadmin: input.asSuperadmin,
    });
    return {
      status: 'match',
      message: result.message?.trim() || 'Song recognized and saved.',
      updated,
      result,
    };
  }

  if (result.status === 'nomatch') {
    return { status: 'nomatch', message: 'No match found.', result };
  }
  if (result.status === 'skipped') {
    return {
      status: 'skipped',
      message:
        result.message?.trim() ||
        'Could not extract enough audio for song ID. Try again or enter the song manually.',
      result,
    };
  }

  return {
    status: 'error',
    message:
      result.message?.trim() ||
      (isFatalSongIdentifyError(result)
        ? 'Song recognition is unavailable right now.'
        : 'Song lookup failed — try again.'),
    result,
  };
}
