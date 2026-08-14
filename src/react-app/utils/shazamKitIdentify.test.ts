import { describe, expect, it } from 'vitest';
import {
  canSendVideoDirectly,
  isTransientShazamKitMatchFailure,
  pickShazamKitMicSource,
  shazamKitMatchToIdentifyResult,
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
    expect(pickShazamKitMicSource(null)).toBeNull();
  });
});

describe('canSendVideoDirectly', () => {
  it('allows only bridge-sized videos', () => {
    expect(canSendVideoDirectly(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES, 'video/mp4'))).toBe(true);
    expect(canSendVideoDirectly(blobOfSize(MIN_IDENTIFY_SAMPLE_BYTES - 1, 'video/mp4'))).toBe(
      false,
    );
    expect(
      canSendVideoDirectly(blobOfSize(MAX_IDENTIFY_UPLOAD_BYTES + 1, 'video/mp4')),
    ).toBe(false);
  });
});

describe('isTransientShazamKitMatchFailure', () => {
  it('retries SHError 202 / ERR_SHAZAMKIT_MATCH_FAILED', () => {
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_MATCH_FAILED',
        message: 'Shazam match attempt failed: The operation couldn’t be completed. (com.apple.ShazamKit error 202.)',
      }),
    ).toBe(true);
  });

  it('does not retry SHError 201 signature-duration failures', () => {
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_SIGNATURE_DURATION',
        message: 'Shazam signature duration is invalid (must be 1–12s)',
      }),
    ).toBe(false);
    expect(
      isTransientShazamKitMatchFailure({
        code: 'ERR_SHAZAMKIT_MATCH_FAILED',
        message:
          'Shazam match attempt failed: The operation couldn’t be completed. (com.apple.ShazamKit error 201.)',
      }),
    ).toBe(false);
    expect(
      isTransientShazamKitMatchFailure(
        new Error('Signature(ID:abc, Duration:14.998980) is invalid and cannot be matched'),
      ),
    ).toBe(false);
  });
});
