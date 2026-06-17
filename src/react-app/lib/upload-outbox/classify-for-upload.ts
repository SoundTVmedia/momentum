import { classifyContentFeedForClip } from '@/react-app/utils/classifyContentFeed';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  effectiveContentFeedForPost,
  hasManualShowArtistVenue,
} from '@/shared/content-feed';
import type { UploadOutboxJob } from './types';

export type ResolvedUploadClassification = {
  classificationId: string;
  contentFeed: 'main' | 'pre_post';
};

export function uploadJobNeedsClassification(job: UploadOutboxJob): boolean {
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
    out = await classifyContentFeedForClip({
      video,
      captureAudio: job.captureAudioBlob ?? null,
      headlinerName: job.form.artist_name?.trim() || null,
    });
  } catch {
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

  return { classificationId, contentFeed };
}
