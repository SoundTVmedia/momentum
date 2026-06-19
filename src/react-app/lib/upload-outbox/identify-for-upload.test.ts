import { describe, expect, it } from 'vitest';
import {
  formPatchFromAcrMatch,
  uploadJobNeedsSongIdentify,
} from './identify-for-upload';
import type { UploadOutboxJob } from './types';

function baseJob(overrides: Partial<UploadOutboxJob> = {}): UploadOutboxJob {
  return {
    id: 'job_1',
    status: 'queued',
    error: null,
    progress: 0,
    createdAt: 1,
    sessionId: null,
    clipId: null,
    idempotencyKey: 'job_1',
    uploadMode: null,
    partUrls: null,
    totalParts: 0,
    partSize: 0,
    fileName: 'clip.webm',
    fileSize: 1000,
    contentType: 'video/webm',
    previewObjectUrl: null,
    blobsReady: true,
    uploadMethod: 'file',
    videoFile: null,
    videoBlob: null,
    thumbnailFile: null,
    videoUrl: '',
    classificationId: '',
    contentFeed: 'main',
    classificationPending: false,
    captureAudioBlob: null,
    form: {
      artist_name: '',
      venue_name: '',
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
    ...overrides,
  };
}

describe('uploadJobNeedsSongIdentify', () => {
  it('runs when main-feed clip has no song title', () => {
    expect(uploadJobNeedsSongIdentify(baseJob())).toBe(true);
  });

  it('skips when song title is already set', () => {
    expect(
      uploadJobNeedsSongIdentify(
        baseJob({ form: { ...baseJob().form, song_title: 'Anti-Hero' } }),
      ),
    ).toBe(false);
  });

  it('skips when song identify was already attempted in the queue', () => {
    expect(uploadJobNeedsSongIdentify(baseJob({ songIdentifyPending: false }))).toBe(false);
  });

  it('skips pre/post clips', () => {
    expect(uploadJobNeedsSongIdentify(baseJob({ contentFeed: 'pre_post' }))).toBe(false);
  });
});

describe('formPatchFromAcrMatch', () => {
  it('fills song and artist when empty', () => {
    const patch = formPatchFromAcrMatch(baseJob(), {
      artist: 'Taylor Swift',
      title: 'Anti-Hero',
    });
    expect(patch.song_title).toBe('Anti-Hero');
    expect(patch.artist_name).toBe('Taylor Swift');
    expect(patch.content_description).toContain('Anti-Hero');
  });

  it('does not overwrite an existing song title', () => {
    const patch = formPatchFromAcrMatch(
      baseJob({ form: { ...baseJob().form, song_title: 'Manual' } }),
      { artist: 'Taylor Swift', title: 'Anti-Hero' },
    );
    expect(patch).toEqual({});
  });
});
