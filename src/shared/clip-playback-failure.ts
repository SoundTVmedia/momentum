/** HTMLMediaElement.error.code values we care about. */
export const MEDIA_ERR_ABORTED = 1;
export const MEDIA_ERR_NETWORK = 2;
export const MEDIA_ERR_DECODE = 3;
export const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

export const PLAYBACK_CLIENT_REPORT_REASON = 'playback_client_report';
export const CLIP_NEEDS_REUPLOAD_NOTIFICATION = 'clip_needs_reupload';

export const USER_SOURCE_UNPLAYABLE_REASONS = [
  'placeholder_video_url',
  'failed_source',
  'r2_404',
  'no_valid_playback',
  'hls_without_stream',
  'client_decode',
  'bad_source_file',
  'stream_and_r2_missing',
] as const;

export const SERVER_PLAYBACK_UNPLAYABLE_REASONS = [
  'stream_missing',
  'server_playback_reports',
] as const;

export type UserSourceUnplayableReason = (typeof USER_SOURCE_UNPLAYABLE_REASONS)[number];
export type ServerPlaybackUnplayableReason = (typeof SERVER_PLAYBACK_UNPLAYABLE_REASONS)[number];

export type PlaybackFailureKind = 'user_source' | 'server_playback';

export type PlaybackFailureDecision =
  | { action: 'ignore' }
  | {
      action: 'hide';
      kind: PlaybackFailureKind;
      reason: string;
      notifyOwner: boolean;
    };

export type ClipPlaybackFailureApiResult = {
  hidden: boolean;
  kind: PlaybackFailureKind | null;
  reason: string | null;
  notifyOwner: boolean;
};

const USER_SOURCE_SET = new Set<string>(USER_SOURCE_UNPLAYABLE_REASONS);

/** Distinct viewers that must report a decode failure before we hide a clip whose sources still exist. */
export const CLIENT_DECODE_VIEWER_THRESHOLD = 2;

export function isUserSourceUnplayableReason(reason: string | null | undefined): boolean {
  return Boolean(reason && USER_SOURCE_SET.has(reason));
}

/**
 * Decide whether a client playback failure should hide the clip from public feeds.
 *
 * - Missing / corrupt sources → hide immediately (owner reupload vs Stream outage).
 * - Network blips while sources exist → ignore.
 * - Decode / unsupported while sources exist → hide for the owner immediately,
 *   otherwise after two distinct viewers so a single simulator/device glitch
 *   cannot take a healthy clip out of every feed.
 */
export function decideClientPlaybackFailure(input: {
  mediaErrorCode: number | null;
  auditPlayable: boolean;
  auditReason: string | null;
  reporterIsOwner: boolean;
  uniqueViewerReports: number;
}): PlaybackFailureDecision {
  if (input.mediaErrorCode === MEDIA_ERR_ABORTED) {
    return { action: 'ignore' };
  }

  if (!input.auditPlayable) {
    const reason = input.auditReason?.trim() || 'no_valid_playback';
    if (reason === 'stream_missing') {
      return {
        action: 'hide',
        kind: 'server_playback',
        reason,
        notifyOwner: false,
      };
    }
    const kind: PlaybackFailureKind = isUserSourceUnplayableReason(reason)
      ? 'user_source'
      : 'server_playback';
    return {
      action: 'hide',
      kind,
      reason,
      notifyOwner: kind === 'user_source',
    };
  }

  if (input.mediaErrorCode === MEDIA_ERR_NETWORK) {
    return { action: 'ignore' };
  }

  const decodeLike =
    input.mediaErrorCode === MEDIA_ERR_DECODE ||
    input.mediaErrorCode === MEDIA_ERR_SRC_NOT_SUPPORTED ||
    input.mediaErrorCode == null;

  if (!decodeLike) return { action: 'ignore' };

  if (input.reporterIsOwner || input.uniqueViewerReports >= CLIENT_DECODE_VIEWER_THRESHOLD) {
    return {
      action: 'hide',
      kind: 'user_source',
      reason: 'client_decode',
      notifyOwner: true,
    };
  }

  return { action: 'ignore' };
}
