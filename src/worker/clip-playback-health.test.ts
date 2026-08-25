import { describe, expect, it } from 'vitest';
import { streamThumbnailUrl } from '../shared/clip-playback';
import {
  decidePlaybackAudit,
  posterUrlToPersist,
  UNPLAYABLE_FLAG_REASON,
} from './clip-playback-health';

const UID = 'a1b2c3d4e5f6789012345678abcdef01';

describe('decidePlaybackAudit', () => {
  it('skips drafts and in-flight uploads', () => {
    expect(decidePlaybackAudit({ id: 1, is_draft: 1, video_url: 'pending:upload' })).toEqual({
      action: 'skip',
      reason: 'draft',
    });
    expect(
      decidePlaybackAudit({ id: 2, upload_status: 'processing', r2_raw_key: 'clips/a.mp4' }),
    ).toEqual({ action: 'skip', reason: 'still_uploading' });
  });

  it('flags placeholder URLs with no Stream or R2 source', () => {
    expect(decidePlaybackAudit({ id: 3, video_url: 'pending:upload' })).toEqual({
      action: 'unplayable',
      reason: 'placeholder_video_url',
    });
  });

  it('checks Stream then R2 when both ids exist', () => {
    expect(
      decidePlaybackAudit({
        id: 4,
        stream_video_id: UID,
        r2_raw_key: 'clips/user/video/a.mp4',
      }),
    ).toEqual({
      action: 'check_stream_then_r2',
      streamId: UID,
      key: 'clips/user/video/a.mp4',
    });
  });

  it('checks R2 for progressive /api/files URLs', () => {
    expect(
      decidePlaybackAudit({
        id: 5,
        video_url: '/api/files/clips%2Fuser%2Fvideo%2Fa.mp4',
      }),
    ).toEqual({ action: 'check_r2', key: 'clips/user/video/a.mp4' });
  });
});

describe('posterUrlToPersist', () => {
  it('keeps an uploaded JPEG', () => {
    expect(posterUrlToPersist({ thumbnail_url: '/api/files/clips/user/thumb.jpg' })).toBe(
      '/api/files/clips/user/thumb.jpg',
    );
  });

  it('falls back to a Stream still at 1s', () => {
    expect(posterUrlToPersist({ stream_video_id: UID })).toBe(
      streamThumbnailUrl(UID, { time: '1s', height: 720 }),
    );
  });

  it('returns null when nothing can produce a poster', () => {
    expect(posterUrlToPersist({ video_url: 'pending:upload' })).toBeNull();
  });
});

describe('unplayable flag reason', () => {
  it('uses a stable moderation reason code', () => {
    expect(UNPLAYABLE_FLAG_REASON).toBe('unplayable_video');
  });
});
