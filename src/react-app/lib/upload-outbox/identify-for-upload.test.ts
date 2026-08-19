import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formPatchFromAcrMatch,
  resolveSongIdentifyAfterUpload,
  resolveSongIdentifyForUploadJob,
  uploadJobDefersSongIdentifyToPublishedClip,
  uploadJobNeedsSongIdentify,
} from './identify-for-upload';
import * as applyClipSongRecognition from '@/react-app/lib/applyClipSongRecognition';
import * as identifySongForUploadedClipModule from '@/react-app/lib/identifySongForUploadedClip';
import * as nativeBridge from '@/react-app/lib/native-bridge';
import * as auddIdentify from '@/react-app/utils/auddIdentify';
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

describe('resolveSongIdentifyAfterUpload guards', () => {
  it('is skipped when song title already set or clip id missing', async () => {
    const video = new Blob([new Uint8Array(8192)], { type: 'video/mp4' });
    expect(
      await resolveSongIdentifyAfterUpload(
        baseJob({ form: { ...baseJob().form, song_title: 'Already' }, clipId: 9 }),
        video,
      ),
    ).toEqual({});
    expect(await resolveSongIdentifyAfterUpload(baseJob({ clipId: null }), video)).toEqual({});
  });
});

describe('device/library uploads', () => {
  beforeEach(() => {
    // These helpers time out with window.setTimeout; tests run in node.
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const bigVideo = () => new Blob([new Uint8Array(1024)], { type: 'video/quicktime' });

  it('defers a large native library pick to the published clip', () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    // iPhone library .mov, no in-app recording path.
    expect(uploadJobDefersSongIdentifyToPublishedClip(baseJob(), 190 * 1024 * 1024)).toBe(true);
  });

  it('still samples locally for quick capture and for small files', () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    expect(
      uploadJobDefersSongIdentifyToPublishedClip(
        baseJob({ nativeVideoUri: 'file:///cache/cpcp_video_1.mp4' }),
        190 * 1024 * 1024,
      ),
    ).toBe(false);
    expect(uploadJobDefersSongIdentifyToPublishedClip(baseJob(), 5 * 1024 * 1024)).toBe(false);
  });

  it('does not defer on web, where the WebAudio ladder is the only option', () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(false);
    expect(uploadJobDefersSongIdentifyToPublishedClip(baseJob(), 190 * 1024 * 1024)).toBe(false);
  });

  it('skips the doomed pre-upload pass for a large native library pick', async () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    const ladder = vi.spyOn(auddIdentify, 'identifyMusicForClip');
    const video = new Blob([new Uint8Array(1024)], { type: 'video/quicktime' });
    Object.defineProperty(video, 'size', { value: 190 * 1024 * 1024 });

    expect(await resolveSongIdentifyForUploadJob(baseJob(), video)).toEqual({});
    expect(ladder).not.toHaveBeenCalled();
  });

  it('identifies a published device upload via the native download path', async () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    vi.spyOn(identifySongForUploadedClipModule, 'fetchClipPlaybackFieldsById').mockResolvedValue({
      video_url: '/api/files/clips%2Fuser%2Fvideo%2FIMG_4016.mov',
    } as never);
    vi.spyOn(identifySongForUploadedClipModule, 'identifySongForUploadedClip').mockResolvedValue({
      status: 'match',
      artist: 'Rihanna',
      title: 'Bitch Better Have My Money',
      message: null,
    });
    const ladder = vi.spyOn(auddIdentify, 'identifyMusicForClip');
    const save = vi
      .spyOn(applyClipSongRecognition, 'saveClipMetadataFields')
      .mockResolvedValue({} as never);

    const patch = await resolveSongIdentifyAfterUpload(baseJob({ clipId: 136 }), bigVideo());

    expect(patch.song_title).toBe('Bitch Better Have My Money');
    expect(patch.artist_name).toBe('Rihanna');
    expect(ladder).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local ladder when the published clip misses', async () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    vi.spyOn(identifySongForUploadedClipModule, 'fetchClipPlaybackFieldsById').mockResolvedValue({
      video_url: '/api/files/clip.mov',
    } as never);
    vi.spyOn(identifySongForUploadedClipModule, 'identifySongForUploadedClip').mockResolvedValue({
      status: 'nomatch',
      message: null,
    });
    const ladder = vi
      .spyOn(auddIdentify, 'identifyMusicForClip')
      .mockResolvedValue({ status: 'nomatch', message: null });

    expect(await resolveSongIdentifyAfterUpload(baseJob({ clipId: 136 }), bigVideo())).toEqual({});
    expect(ladder).toHaveBeenCalledTimes(1);
  });

  it('keeps the local recording path for quick capture', async () => {
    vi.spyOn(nativeBridge, 'isNativeApp').mockReturnValue(true);
    const published = vi.spyOn(
      identifySongForUploadedClipModule,
      'identifySongForUploadedClip',
    );
    const ladder = vi
      .spyOn(auddIdentify, 'identifyMusicForClip')
      .mockResolvedValue({ status: 'nomatch', message: null });

    await resolveSongIdentifyAfterUpload(
      baseJob({ clipId: 42, nativeVideoUri: 'file:///cache/cpcp_video_1.mp4' }),
      bigVideo(),
    );

    expect(published).not.toHaveBeenCalled();
    expect(ladder).toHaveBeenCalledTimes(1);
  });
});
