import { describe, expect, it } from 'vitest';
import { captionDraftMatchesVideo } from './caption-draft';
import type { UploadCaptionDraft } from './caption-draft';

function draft(blobSourceKey: string): UploadCaptionDraft {
  return {
    savedAtMs: Date.now(),
    blobSourceKey,
    uploadMethod: 'file',
    uploadSource: 'capture',
    form: {
      video_url: '',
      thumbnail_url: '',
      artist_name: 'Artist',
      venue_name: 'Venue',
      location: '',
      content_description: '',
      song_title: '',
      genre_name: '',
      hashtags: '',
    },
    jambaseLink: null,
    recordingAtIso: null,
    captureGeo: null,
    videoMetadata: {},
    artistSearch: '',
    venueSearch: '',
    storedClassificationId: null,
    classifyResult: null,
  };
}

describe('captionDraftMatchesVideo', () => {
  it('matches when blob source keys are equal', () => {
    const key = 'blob:12345:video/webm';
    expect(captionDraftMatchesVideo(draft(key), key)).toBe(true);
  });

  it('rejects mismatched or missing drafts', () => {
    expect(captionDraftMatchesVideo(draft('a'), 'b')).toBe(false);
    expect(captionDraftMatchesVideo(null, 'a')).toBe(false);
  });
});
