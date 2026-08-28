import { describe, expect, it } from 'vitest';
import {
  CLIENT_DECODE_VIEWER_THRESHOLD,
  decideClientPlaybackFailure,
  MEDIA_ERR_ABORTED,
  MEDIA_ERR_DECODE,
  MEDIA_ERR_NETWORK,
  MEDIA_ERR_SRC_NOT_SUPPORTED,
} from './clip-playback-failure';

describe('decideClientPlaybackFailure', () => {
  it('ignores user-aborted loads', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_ABORTED,
        auditPlayable: false,
        auditReason: 'r2_404',
        reporterIsOwner: true,
        uniqueViewerReports: 5,
      }),
    ).toEqual({ action: 'ignore' });
  });

  it('hides missing Stream as a server issue without asking the owner to reupload', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_SRC_NOT_SUPPORTED,
        auditPlayable: false,
        auditReason: 'stream_missing',
        reporterIsOwner: false,
        uniqueViewerReports: 1,
      }),
    ).toEqual({
      action: 'hide',
      kind: 'server_playback',
      reason: 'stream_missing',
      notifyOwner: false,
    });
  });

  it('hides missing originals as a user source problem', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: 4,
        auditPlayable: false,
        auditReason: 'r2_404',
        reporterIsOwner: false,
        uniqueViewerReports: 1,
      }),
    ).toEqual({
      action: 'hide',
      kind: 'user_source',
      reason: 'r2_404',
      notifyOwner: true,
    });
  });

  it('ignores a lone network error when sources still exist', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_NETWORK,
        auditPlayable: true,
        auditReason: null,
        reporterIsOwner: false,
        uniqueViewerReports: 3,
      }),
    ).toEqual({ action: 'ignore' });
  });

  it('lets the owner confirm a decode failure immediately', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_DECODE,
        auditPlayable: true,
        auditReason: null,
        reporterIsOwner: true,
        uniqueViewerReports: 1,
      }),
    ).toEqual({
      action: 'hide',
      kind: 'user_source',
      reason: 'client_decode',
      notifyOwner: true,
    });
  });

  it('waits for a second viewer before hiding a decode failure', () => {
    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_SRC_NOT_SUPPORTED,
        auditPlayable: true,
        auditReason: null,
        reporterIsOwner: false,
        uniqueViewerReports: 1,
      }),
    ).toEqual({ action: 'ignore' });

    expect(
      decideClientPlaybackFailure({
        mediaErrorCode: MEDIA_ERR_SRC_NOT_SUPPORTED,
        auditPlayable: true,
        auditReason: null,
        reporterIsOwner: false,
        uniqueViewerReports: CLIENT_DECODE_VIEWER_THRESHOLD,
      }),
    ).toEqual({
      action: 'hide',
      kind: 'user_source',
      reason: 'client_decode',
      notifyOwner: true,
    });
  });
});
