import { acrMatchToClipFieldPatch, type AcrClipFieldSnapshot } from '@/react-app/lib/acrClipFieldPatch';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { identifySongForUploadedClip } from '@/react-app/lib/identifySongForUploadedClip';
import type { ClipPlaybackFields } from '@/shared/clip-playback';
import type { IdentifyStageReporter } from '@/shared/identify-stage';
import { IDENTIFY_CLIP_PLAYER_TIMEOUT_MS } from '@/shared/identify-music-limits';
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
  /** Superadmin: explicit show title override. */
  event_title?: string;
  jambase_event_id?: string | null;
  jambase_artist_id?: string | null;
  jambase_venue_id?: string | null;
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

/**
 * Must stay above the native budgets this wraps. It used to be 60s around a
 * 120s ShazamKit window scan, so every scan that needed more than a minute was
 * aborted by its own caller and reported as a timeout.
 */
const CLIP_PLAYER_IDENTIFY_TIMEOUT_MS = IDENTIFY_CLIP_PLAYER_TIMEOUT_MS;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function runClipSongRecognitionAndSave(input: {
  clip: ClipPlaybackFields;
  currentFields: AcrClipFieldSnapshot & ClipMetadataSaveFields;
  asSuperadmin?: boolean;
  onStage?: IdentifyStageReporter;
}): Promise<ClipSongRecognitionOutcome> {
  const result = normalizeIdentifyResult(
    await withTimeout(
      identifySongForUploadedClip(input.clip, { onStage: input.onStage }),
      CLIP_PLAYER_IDENTIFY_TIMEOUT_MS,
      'Song identification timed out. Try again.',
    ),
  );

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
      event_title: input.currentFields.event_title,
      jambase_event_id: input.currentFields.jambase_event_id,
      jambase_artist_id: input.currentFields.jambase_artist_id,
      jambase_venue_id: input.currentFields.jambase_venue_id,
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
