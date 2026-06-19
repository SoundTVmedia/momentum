import { classifyContentFeedForClip } from '@/react-app/utils/classifyContentFeed';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  effectiveContentFeedForPost,
  hasManualShowArtistVenue,
} from '@/shared/content-feed';
import { formPatchFromClassification } from './identify-for-upload';
import type { UploadOutboxJob } from './types';
import type { ClipUploadFormFields } from '@/react-app/lib/processClipUpload';

export type ResolvedUploadClassification = {
  classificationId: string;
  contentFeed: 'main' | 'pre_post';
  formPatch?: Partial<ClipUploadFormFields>;
};

const CLASSIFY_TIMEOUT_MS = 45_000;

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

export function uploadJobNeedsClassification(job: UploadOutboxJob): boolean {
  if (BYPASS_CONTENT_FEED_BIFURCATION) return false;
  if (job.classificationPending) return true;
  if (hasManualShowArtistVenue(job.form.artist_name, job.form.venue_name)) return false;
  return !job.classificationId?.trim();
}

export async function resolveClassificationForUploadJob(
  job: UploadOutboxJob,
  video: Blob,
): Promise<ResolvedUploadClassification> {
  if (hasManualShowArtistVenue(job.form.artist_name, job.form.venue_name)) {
    return { classificationId: '', contentFeed: 'main' };
  }

  if (job.classificationId?.trim() && !job.classificationPending) {
    return {
      classificationId: job.classificationId.trim(),
      contentFeed: job.contentFeed ?? 'main',
    };
  }

  let out: Awaited<ReturnType<typeof classifyContentFeedForClip>>;
  try {
    out = await withTimeout(
      classifyContentFeedForClip({
        video,
        captureAudio: job.captureAudioBlob ?? null,
        headlinerName: job.form.artist_name?.trim() || null,
      }),
      CLASSIFY_TIMEOUT_MS,
      'Classification timed out',
    );
  } catch (err) {
    if (err instanceof TypeError) {
      throw err;
    }
    throw new TypeError('Network error during content classification');
  }

  if (!out.ok) {
    throw new Error(out.error);
  }

  if (out.content_feed === 'rejected' && !BYPASS_CONTENT_FEED_BIFURCATION) {
    throw new Error(out.message);
  }

  const contentFeed = effectiveContentFeedForPost(out.content_feed);
  if (contentFeed !== 'main' && contentFeed !== 'pre_post') {
    throw new Error('Invalid content feed classification.');
  }

  const classificationId = out.classification_id?.trim() ?? '';
  if (!classificationId) {
    throw new Error('Classification did not return an id. Try again.');
  }

  return {
    classificationId,
    contentFeed,
    formPatch: formPatchFromClassification(job, out),
  };
}
