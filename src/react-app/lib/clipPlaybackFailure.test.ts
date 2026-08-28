import { afterEach, describe, expect, it } from 'vitest';
import {
  filterViewerFeedClips,
  isLocallySkippedClip,
  rememberLocallySkippedClip,
} from './clipPlaybackFailure';

const UID = 'a1b2c3d4e5f6789012345678abcdef01';

describe('filterViewerFeedClips', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('hides worker-flagged clips and this session’s failed players', () => {
    rememberLocallySkippedClip(2);
    expect(isLocallySkippedClip(2)).toBe(true);
    expect(
      filterViewerFeedClips([
        { id: 1, stream_video_id: UID },
        { id: 2, stream_video_id: UID },
        { id: 3, playback_unplayable: 1, stream_video_id: UID },
      ]),
    ).toEqual([{ id: 1, stream_video_id: UID }]);
  });
});
