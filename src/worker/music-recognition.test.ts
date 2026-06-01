import { describe, expect, it } from 'vitest';
import {
  describeMusicRecognitionConfig,
  inferIdentifyFilename,
  shouldFallbackAcrToAudd,
} from './music-recognition';

describe('describeMusicRecognitionConfig', () => {
  it('reports ACR ready when all three vars are set', () => {
    const s = describeMusicRecognitionConfig({
      ACRCLOUD_HOST: 'identify-us-west-2.acrcloud.com',
      ACRCLOUD_ACCESS_KEY: 'key',
      ACRCLOUD_ACCESS_SECRET: 'secret',
    });
    expect(s.activeProvider).toBe('acrcloud');
    expect(s.acrcloud.ready).toBe(true);
    expect(s.auddFallbackAvailable).toBe(false);
    expect(s.hint).toMatch(/optional fallback/i);
  });

  it('hints when host is set without secrets', () => {
    const s = describeMusicRecognitionConfig({
      ACRCLOUD_HOST: 'identify-us-west-2.acrcloud.com',
    });
    expect(s.acrcloud.ready).toBe(false);
    expect(s.hint).toMatch(/access key or secret/i);
  });
});

describe('inferIdentifyFilename', () => {
  it('maps blob MIME to extension for ACR', () => {
    expect(inferIdentifyFilename(new Blob([], { type: 'audio/webm' }))).toBe('snippet.webm');
    expect(inferIdentifyFilename(new Blob([], { type: 'video/mp4' }))).toBe('snippet.m4a');
  });
});

describe('shouldFallbackAcrToAudd', () => {
  it('falls back on fingerprint error when AudD is configured', () => {
    expect(
      shouldFallbackAcrToAudd(
        { ok: false, error: 'fingerprint', acrcloudCode: 2004 },
        true,
      ),
    ).toBe(true);
  });

  it('falls back on short WebM fragment', () => {
    expect(
      shouldFallbackAcrToAudd(
        { ok: true, match: null, status: 'no_match', skippedReason: 'fragment_too_short' },
        true,
      ),
    ).toBe(true);
  });

  it('does not fall back on invalid credentials', () => {
    expect(
      shouldFallbackAcrToAudd(
        { ok: false, error: 'bad key', acrcloudCode: 3001 },
        true,
      ),
    ).toBe(false);
  });
});
