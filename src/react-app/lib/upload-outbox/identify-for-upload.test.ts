import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formPatchFromAcrMatch,
  resolveSongIdentifyAfterUpload,
  uploadJobNeedsSongIdentify,
} from './identify-for-upload';
import * as applyClipSongRecognition from '@/react-app/lib/applyClipSongRecognition';
import * as identifySongForUploadedClipModule from '@/react-app/lib/identifySongForUploadedClip';
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

describe('resolveSongIdentifyAfterUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is skipped when song title already set or clip id missing', async () => {
    expect(
      await resolveSongIdentifyAfterUpload(
        baseJob({ form: { ...baseJob().form, song_title: 'Already' }, clipId: 9 }),
      ),
    ).toEqual({});
    expect(await resolveSongIdentifyAfterUpload(baseJob({ clipId: null }))).toEqual({});
  });

  it('identifies the published clip via ShazamKit→ACR and PATCHes a match', async () => {
    vi.spyOn(identifySongForUploadedClipModule, 'fetchClipPlaybackFieldsById').mockResolvedValue({
      video_url: '/api/files/clips%2Fuser%2Fvideo%2FIMG_4016.mov',
    } as never);
    vi.spyOn(identifySongForUploadedClipModule, 'identifySongForUploadedClip').mockResolvedValue({
      status: 'match',
      artist: 'Rihanna',
      title: 'Bitch Better Have My Money',
      message: null,
    });
    const save = vi
      .spyOn(applyClipSongRecognition, 'saveClipMetadataFields')
      .mockResolvedValue({} as never);

    const patch = await resolveSongIdentifyAfterUpload(baseJob({ clipId: 136 }));

    expect(patch.song_title).toBe('Bitch Better Have My Money');
    expect(patch.artist_name).toBe('Rihanna');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not PATCH when the published-clip pass misses', async () => {
    vi.spyOn(identifySongForUploadedClipModule, 'fetchClipPlaybackFieldsById').mockResolvedValue({
      video_url: '/api/files/clip.mov',
    } as never);
    vi.spyOn(identifySongForUploadedClipModule, 'identifySongForUploadedClip').mockResolvedValue({
      status: 'nomatch',
      message: null,
    });
    const save = vi.spyOn(applyClipSongRecognition, 'saveClipMetadataFields');

    expect(await resolveSongIdentifyAfterUpload(baseJob({ clipId: 136 }))).toEqual({});
    expect(save).not.toHaveBeenCalled();
  });

  it('uses the published clip even when a local native recording path exists', async () => {
    vi.spyOn(identifySongForUploadedClipModule, 'fetchClipPlaybackFieldsById').mockResolvedValue({
      video_url: '/api/files/clip.mp4',
    } as never);
    const published = vi
      .spyOn(identifySongForUploadedClipModule, 'identifySongForUploadedClip')
      .mockResolvedValue({ status: 'nomatch', message: null });

    await resolveSongIdentifyAfterUpload(
      baseJob({ clipId: 42, nativeVideoUri: 'file:///cache/cpcp_video_1.mp4' }),
    );

    expect(published).toHaveBeenCalledTimes(1);
  });
});
