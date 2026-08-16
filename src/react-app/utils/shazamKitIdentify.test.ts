import { describe, expect, it } from 'vitest';
import {
  canSendVideoDirectly,
  isShazamKitDecodableOnIos,
  isTransientShazamKitMatchFailure,
  pickShazamKitMicSource,
  shazamKitMatchToIdentifyResult,
  shazamKitScanWindowStarts,
  SHAZAMKIT_MAX_DIRECT_BYTES,
} from './shazamKitIdentify';
import {
  MAX_IDENTIFY_UPLOAD_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@/shared/identify-music-limits';

function blobOfSize(size: number, type: string): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

describe('shazamKitMatchToIdentifyResult', () => {
  it('maps a full match onto the identify result shape', () => {
    const r = shazamKitMatchToIdentifyResult({
      title: ' Harvest Moon ',
      artist: 'Neil Young',
      album: null,
      genres: ['Rock'],
      isrc: 'USRE19200001',
      appleMusicId: '123',
      appleMusicUrl: 'https://music.apple.com/song/123',
      shazamId: 'abc',
      confidence: 0.9,
    });
    expect(r).toEqual({
      status: 'match',
      artist: 'Neil Young',
      title: 'Harvest Moon',
      message: 'Identified: Harvest Moon — Neil Young',
      confidence: 0.9,
    });
  });

  it('handles title-only matches and drops non-finite confidence', () => {
    const r = shazamKitMatchToIdentifyResult({
      title: 'Encore Jam',
      artist: null,
      album: null,
      genres: null,
      isrc: null,
      appleMusicId: null,
      appleMusicUrl: null,
      shazamId: null,
      confidence: Number.NaN,
    });
    expect(r.status).toBe('match');
    if (r.status === 'match') {
      expect(r.title).toBe('Encore Jam');
      expect(r.artist).toBe('');
      expect(r.message).toBe('Identified: Encore Jam');
      expect(r.confidence).toBeUndefined();
    }
  });

  it('maps null / empty payloads to nomatch', () => {
    expect(shazamKitMatchToIdentifyResult(null)).toEqual({
      status: 'nomatch',
      message: null,
    });
    expect(
      shazamKitMatchToIdentifyResult({
        title: '  ',
        artist: '',
        album: null,
        genres: null,
        isrc: null,
        appleMusicId: null,
        appleMusicUrl: null,
        shazamId: null,
        confidence: null,
      }),
    ).toEqual({ status: 'nomatch', message: null });
  });
});

describe('pickShazamKitMicSource', () => {
  it('prefers the parallel mic audio when it fits the bridge', () => {
    const audio = blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES * 2, 'audio/mp4');
    expect(pickShazamKitMicSource(audio)).toBe(audio);
  });

  it('rejects mic audio that is too small, too large, or not audio', () => {
    expect(pickShazamKitMicSource(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES - 1, 'audio/mp4'))).toBeNull();
    expect(
      pickShazamKitMicSource(blobOfSize(SHAZAMKIT_MAX_DIRECT_BYTES + 1, 'audio/mp4')),
    ).toBeNull();
    expect(pickShazamKitMicSource(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES * 2, 'video/mp4'))).toBeNull();
    expect(
      pickShazamKitMicSource(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES * 2, 'audio/webm;codecs=opus')),
    ).toBeNull();
    expect(pickShazamKitMicSource(null)).toBeNull();
  });
});

describe('isShazamKitDecodableOnIos', () => {
  it('accepts WAV / AAC / MP4 and rejects WebM / Opus / Ogg', () => {
    expect(isShazamKitDecodableOnIos('audio/wav')).toBe(true);
    expect(isShazamKitDecodableOnIos('audio/mp4')).toBe(true);
    expect(isShazamKitDecodableOnIos('audio/aac')).toBe(true);
    expect(isShazamKitDecodableOnIos('video/mp4')).toBe(true);
    expect(isShazamKitDecodableOnIos('')).toBe(true);
    expect(isShazamKitDecodableOnIos('audio/webm;codecs=opus')).toBe(false);
    expect(isShazamKitDecodableOnIos('video/webm')).toBe(false);
    expect(isShazamKitDecodableOnIos('audio/ogg')).toBe(false);
  });
});

describe('isTransientShazamKitMatchFailure', () => {
  it('retries only SHError 202, not invalid-signature 201', () => {
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_MATCH_FAILED',
        message: 'Shazam match attempt failed: (com.apple.ShazamKit error 202.)',
      }),
    ).toBe(true);
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_MATCH_FAILED',
        message: 'Shazam match attempt failed: (com.apple.ShazamKit error 201.)',
      }),
    ).toBe(false);
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_BAD_FILE',
        message: 'Could not load audio tracks: Cannot Open',
      }),
    ).toBe(false);
  });
});

describe('shazamKitScanWindowStarts', () => {
  it('uses only the opening window for short or unknown clips', () => {
    expect(shazamKitScanWindowStarts(null)).toEqual([0]);
    expect(shazamKitScanWindowStarts(10)).toEqual([0]);
    expect(shazamKitScanWindowStarts(16)).toEqual([0]);
  });

  it('adds mid and last 11s windows for longer library clips', () => {
    expect(shazamKitScanWindowStarts(17)).toEqual([0, 17 / 2 - 5.5]);
    expect(shazamKitScanWindowStarts(45)).toEqual([0, 45 / 2 - 5.5, 45 - 11]);
  });
});

describe('canSendVideoDirectly', () => {
  it('allows only bridge-sized videos that iOS can decode', () => {
    expect(canSendVideoDirectly(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES, 'video/mp4'))).toBe(true);
    expect(canSendVideoDirectly(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES - 1, 'video/mp4'))).toBe(
      false,
    );
    expect(
      canSendVideoDirectly(blobOfSize(MAX_IDENTIFY_UPLOAD_BYTES + 1, 'video/mp4')),
    ).toBe(false);
    expect(canSendVideoDirectly(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES, 'video/webm'))).toBe(false);
  });
});
