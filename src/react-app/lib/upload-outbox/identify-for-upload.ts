import { acrMatchToClipFieldPatch } from '@/react-app/lib/acrClipFieldPatch';
import { saveClipMetadataFields } from '@/react-app/lib/applyClipSongRecognition';
import {
  fetchClipPlaybackFieldsById,
  identifySongForUploadedClip,
} from '@/react-app/lib/identifySongForUploadedClip';
import type { ClipUploadFormFields } from '@/react-app/lib/processClipUpload';
import { normalizeIdentifyResult } from '@/react-app/utils/auddIdentify';
import { IDENTIFY_CLIP_PLAYER_TIMEOUT_MS } from '@/shared/identify-music-limits';
import { isPrePostContentFeed } from '@/shared/pre-post-clip';
import type { ContentFeedClassification } from '@/shared/content-feed';
import type { UploadOutboxJob } from './types';

/** Same budget as in-player tap-to-identify (download + ShazamKit + ACR). */
const PUBLISHED_CLIP_IDENTIFY_TIMEOUT_MS = IDENTIFY_CLIP_PLAYER_TIMEOUT_MS;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new TypeError(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function uploadJobNeedsSongIdentify(job: UploadOutboxJob): boolean {
  if (job.uploadMethod !== 'file') return false;
  if (isPrePostContentFeed(job.contentFeed)) return false;
  if (job.form.song_title?.trim()) return false;
  return job.songIdentifyPending !== false;
}

export function formPatchFromAcrMatch(
  job: UploadOutboxJob,
  match: { artist?: string | null; title?: string | null },
): Partial<ClipUploadFormFields> {
  if (job.form.song_title?.trim()) return {};
  return acrMatchToClipFieldPatch(job.form, match, { overwriteSongTitle: false });
}

export function formPatchFromClassification(
  job: UploadOutboxJob,
  classification: Pick<ContentFeedClassification, 'acr_matched' | 'acr_artist' | 'acr_title'>,
): Partial<ClipUploadFormFields> {
  if (!classification.acr_matched) return {};
  return formPatchFromAcrMatch(job, {
    artist: classification.acr_artist,
    title: classification.acr_title,
  });
}

/**
 * After the clip is published: if the caption still left song_title empty,
 * run ShazamKit→ACR on the published file and PATCH the saved clip. Best-effort.
 * Does not sample the local recording — that path skipped ACR after a Shazam miss.
 */
export async function resolveSongIdentifyAfterUpload(
  job: UploadOutboxJob,
): Promise<Partial<ClipUploadFormFields>> {
  if (!uploadJobNeedsSongIdentify(job)) return {};
  if (job.clipId == null || job.clipId <= 0) return {};

  try {
    const clip = await fetchClipPlaybackFieldsById(job.clipId);
    if (!clip) {
      console.warn('[identify] upload published clip missing', job.clipId);
      return {};
    }

    console.log('[identify] upload published-clip song ID', job.clipId);
    const result = normalizeIdentifyResult(
      await withTimeout(
        identifySongForUploadedClip(clip),
        PUBLISHED_CLIP_IDENTIFY_TIMEOUT_MS,
        'Published-clip song identification timed out',
      ),
    );
    if (result.status !== 'match') return {};
    const formPatch = formPatchFromAcrMatch(job, {
      artist: result.artist,
      title: result.title,
    });
    if (!formPatch.song_title?.trim()) return {};

    const nextForm = { ...job.form, ...formPatch };
    await saveClipMetadataFields(
      { id: job.clipId } as Parameters<typeof saveClipMetadataFields>[0],
      {
        artist_name: nextForm.artist_name ?? '',
        venue_name: nextForm.venue_name ?? '',
        location: nextForm.location ?? '',
        content_description: nextForm.content_description ?? '',
        hashtags: nextForm.hashtags ?? '',
        song_title: nextForm.song_title ?? '',
        genre_name: nextForm.genre_name ?? '',
      },
    );
    return formPatch;
  } catch (err) {
    console.warn('resolveSongIdentifyAfterUpload:', err);
    return {};
  }
}
