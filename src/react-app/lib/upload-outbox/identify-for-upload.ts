import { acrMatchToClipFieldPatch } from '@/react-app/lib/acrClipFieldPatch';
import { saveClipMetadataFields } from '@/react-app/lib/applyClipSongRecognition';
import type { ClipUploadFormFields } from '@/react-app/lib/processClipUpload';
import { identifyMusicForClip } from '@/react-app/utils/auddIdentify';
import { isPrePostContentFeed } from '@/shared/pre-post-clip';
import type { ContentFeedClassification } from '@/shared/content-feed';
import type { UploadOutboxJob } from './types';

const SONG_IDENTIFY_TIMEOUT_MS = 60_000;
const POST_UPLOAD_SONG_IDENTIFY_TIMEOUT_MS = 45_000;

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
  // Default: ShazamKit first, then ACRCloud, when the clip has no song title yet.
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

/** Run full identify pass when caption screen did not find a song. Best-effort — never blocks upload. */
export async function resolveSongIdentifyForUploadJob(
  job: UploadOutboxJob,
  video: Blob,
  captureAudio?: Blob | null,
): Promise<Partial<ClipUploadFormFields>> {
  if (!uploadJobNeedsSongIdentify(job)) return {};

  try {
    const result = await withTimeout(
      identifyMusicForClip(video, {
        audio: captureAudio ?? job.captureAudioBlob ?? null,
        nativeFilePath: job.nativeVideoUri ?? null,
        expectedArtist: job.form.artist_name,
      }),
      SONG_IDENTIFY_TIMEOUT_MS,
      'Song identification timed out',
    );
    if (result.status !== 'match') return {};
    return formPatchFromAcrMatch(job, { artist: result.artist, title: result.title });
  } catch (err) {
    console.warn('resolveSongIdentifyForUploadJob:', err);
    return {};
  }
}

/**
 * After the clip is published: if capture/outbox still left song_title empty,
 * run ShazamKit→ACR on the local video and PATCH the saved clip. Best-effort.
 */
export async function resolveSongIdentifyAfterUpload(
  job: UploadOutboxJob,
  video: Blob,
  captureAudio?: Blob | null,
): Promise<Partial<ClipUploadFormFields>> {
  if (job.uploadMethod !== 'file') return {};
  if (isPrePostContentFeed(job.contentFeed)) return {};
  if (job.form.song_title?.trim()) return {};
  if (job.clipId == null || job.clipId <= 0) return {};

  try {
    const result = await withTimeout(
      identifyMusicForClip(video, {
        audio: captureAudio ?? job.captureAudioBlob ?? null,
        nativeFilePath: job.nativeVideoUri ?? null,
        expectedArtist: job.form.artist_name,
      }),
      POST_UPLOAD_SONG_IDENTIFY_TIMEOUT_MS,
      'Post-upload song identification timed out',
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
