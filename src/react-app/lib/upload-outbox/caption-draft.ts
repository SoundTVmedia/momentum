import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import type { ContentFeedClassification } from '@/shared/content-feed';
import { deleteMetaRecord, loadMetaRecord, saveMetaRecord } from './idb';

const CAPTION_DRAFT_META_KEY = 'caption_draft';

/** Caption + metadata saved while the user is on the post-capture screen (before Share). */
export type UploadCaptionDraft = {
  savedAtMs: number;
  blobSourceKey: string;
  uploadMethod: 'file' | 'url';
  uploadSource: 'capture' | 'library';
  form: {
    video_url: string;
    thumbnail_url: string;
    artist_name: string;
    venue_name: string;
    location: string;
    content_description: string;
    song_title: string;
    genre_name: string;
    hashtags: string;
  };
  jambaseLink: ClipUploadJobPayload['jambaseLink'];
  recordingAtIso: string | null;
  captureGeo: ClipUploadJobPayload['captureGeo'];
  videoMetadata: ClipUploadJobPayload['videoMetadata'];
  artistSearch: string;
  venueSearch: string;
  storedClassificationId: string | null;
  classifyResult: ContentFeedClassification | null;
};

export function captionDraftMatchesVideo(
  draft: UploadCaptionDraft | null | undefined,
  blobSourceKey: string,
): draft is UploadCaptionDraft {
  return Boolean(draft?.blobSourceKey && draft.blobSourceKey === blobSourceKey);
}

export async function loadCaptionDraft(): Promise<UploadCaptionDraft | null> {
  try {
    return await loadMetaRecord<UploadCaptionDraft>(CAPTION_DRAFT_META_KEY);
  } catch (err) {
    console.warn('loadCaptionDraft:', err);
    return null;
  }
}

export async function saveCaptionDraft(draft: UploadCaptionDraft): Promise<void> {
  try {
    await saveMetaRecord(CAPTION_DRAFT_META_KEY, draft);
  } catch (err) {
    console.warn('saveCaptionDraft:', err);
  }
}

export async function clearCaptionDraft(): Promise<void> {
  try {
    await deleteMetaRecord(CAPTION_DRAFT_META_KEY);
  } catch (err) {
    console.warn('clearCaptionDraft:', err);
  }
}
