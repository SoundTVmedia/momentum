import type { ClipUploadFormFields } from '@/react-app/lib/processClipUpload';
import {
  identifyMusicForClip,
  mergeSongTitleIntoCaption,
} from '@/react-app/utils/auddIdentify';
import { isPrePostContentFeed } from '@/shared/pre-post-clip';
import type { ContentFeedClassification } from '@/shared/content-feed';
import type { UploadOutboxJob } from './types';

const SONG_IDENTIFY_TIMEOUT_MS = 60_000;

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
  return !job.form.song_title?.trim();
}

export function formPatchFromAcrMatch(
  job: UploadOutboxJob,
  match: { artist?: string | null; title?: string | null },
): Partial<ClipUploadFormFields> {
  if (job.form.song_title?.trim()) return {};

  const title = match.title?.trim() ?? '';
  const artist = match.artist?.trim() ?? '';
  if (!title && !artist) return {};

  const patch: Partial<ClipUploadFormFields> = {};
  if (title) {
    patch.song_title = title;
    patch.content_description = mergeSongTitleIntoCaption(job.form.content_description, title);
  }
  if (artist && !job.form.artist_name?.trim()) {
    patch.artist_name = artist;
  }
  return patch;
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
): Promise<Partial<ClipUploadFormFields>> {
  if (!uploadJobNeedsSongIdentify(job)) return {};

  try {
    const result = await withTimeout(
      identifyMusicForClip(video, { audio: job.captureAudioBlob ?? null }),
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
