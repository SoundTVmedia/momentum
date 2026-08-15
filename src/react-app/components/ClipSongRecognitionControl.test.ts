import { describe, expect, it } from 'vitest';
import { TAP_TO_IDENTIFY_SONG_LABEL } from './ClipSongRecognitionControl';

describe('ClipSongRecognitionControl copy', () => {
  it('uses the player/edit label Tap to identify song', () => {
    expect(TAP_TO_IDENTIFY_SONG_LABEL).toBe('Tap to identify song');
  });
});
