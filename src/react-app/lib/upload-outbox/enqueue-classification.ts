import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  effectiveContentFeedForPost,
  hasManualShowArtistVenue,
} from '@/shared/content-feed';
import type { ContentFeedClassification } from '@/shared/content-feed';

export type EnqueueClassificationInput = {
  uploadMethod: 'file' | 'url';
  form: {
    artist_name: string;
    venue_name: string;
    location: string;
  };
  storedClassificationId: string | null;
  classifyResult: ContentFeedClassification | null;
};

export type EnqueueClassificationResult =
  | {
      ok: true;
      classificationId: string;
      contentFeed: 'main' | 'pre_post';
      classificationPending: boolean;
    }
  | { ok: false; error: string };

export function resolveEnqueueClassification(
  input: EnqueueClassificationInput,
): EnqueueClassificationResult {
  const { uploadMethod, form, storedClassificationId, classifyResult } = input;

  if (hasManualShowArtistVenue(form.artist_name, form.venue_name)) {
    return {
      ok: true,
      classificationId: '',
      contentFeed: 'main',
      classificationPending: false,
    };
  }

  if (
    storedClassificationId &&
    classifyResult &&
    (BYPASS_CONTENT_FEED_BIFURCATION ||
      (classifyResult.content_feed !== 'rejected' &&
        (classifyResult.content_feed === 'main' || classifyResult.content_feed === 'pre_post')))
  ) {
    return {
      ok: true,
      classificationId: storedClassificationId,
      contentFeed: effectiveContentFeedForPost(classifyResult.content_feed),
      classificationPending: false,
    };
  }

  if (uploadMethod === 'url') {
    return {
      ok: false,
      error:
        'For URL uploads, add artist and venue manually, or upload a video file for auto-tagging.',
    };
  }

  return {
    ok: true,
    classificationId: '',
    contentFeed: 'main',
    classificationPending: true,
  };
}
