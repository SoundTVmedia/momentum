import { describe, expect, it } from 'vitest';
import {
  uploadJobLabel,
  uploadJobNeedsShowPicker,
  uploadJobStatusText,
} from './upload-queue-status';
import type { UploadOutboxJob } from './types';

function job(overrides: Partial<UploadOutboxJob> = {}): UploadOutboxJob {
  return {
    id: 'job-1',
    status: 'published',
    error: null,
    progress: 100,
    createdAt: 1,
    sessionId: null,
    clipId: 1,
    idempotencyKey: 'k',
    uploadMode: null,
    partUrls: null,
    totalParts: 0,
    partSize: 0,
    fileName: 'clip.mp4',
    fileSize: 1,
    contentType: 'video/mp4',
    previewObjectUrl: null,
    blobsReady: true,
    uploadMethod: 'file',
    videoFile: null,
    videoBlob: null,
    thumbnailFile: null,
    videoUrl: '',
    classificationId: '',
    form: {
      artist_name: 'Jay-Z',
      venue_name: 'Yankee Stadium',
      location: 'Bronx, NY',
      content_description: '',
      song_title: '',
      genre_name: '',
      hashtags: '',
    },
    jambaseLink: null,
    recordingAtIso: null,
    captureGeo: null,
    videoMetadata: {},
    captureTimestampMissing: true,
    ...overrides,
  } as UploadOutboxJob;
}

describe('uploadJobNeedsShowPicker', () => {
  it('asks for a show when the file had no capture time and no event was tagged', () => {
    expect(uploadJobNeedsShowPicker(job())).toBe(true);
  });

  it('skips the picker when the clip was uploaded to a show page', () => {
    expect(
      uploadJobNeedsShowPicker(
        job({
          jambaseLink: {
            event: 'jambase:jayz-yankee',
            artist: 'jambase:jayz',
            venue: 'jambase:yankee',
            eventTitle: 'Jay-Z at Yankee Stadium',
          },
        }),
      ),
    ).toBe(false);
  });
});

describe('uploadJobStatusText', () => {
  it('does not ask to choose a show when the event is already tagged', () => {
    expect(
      uploadJobStatusText(
        job({
          jambaseLink: {
            event: 'jambase:jayz-yankee',
            artist: null,
            venue: null,
            eventTitle: 'Jay-Z at Yankee Stadium',
          },
        }),
      ),
    ).toBe('Posted');
  });
});

describe('uploadJobLabel', () => {
  it('uses the event name when present', () => {
    expect(
      uploadJobLabel(
        job({
          jambaseLink: {
            event: 'jambase:jayz-yankee',
            artist: null,
            venue: null,
            eventTitle: 'Jay-Z at Yankee Stadium',
          },
        }),
      ),
    ).toBe('Jay-Z at Yankee Stadium');
  });
});
