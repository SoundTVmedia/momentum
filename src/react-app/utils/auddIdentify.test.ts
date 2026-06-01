import { describe, expect, it } from 'vitest';
import { isFatalSongIdentifyError, normalizeIdentifyResult } from './auddIdentify';

describe('normalizeIdentifyResult', () => {
  it('clears message for nomatch and skipped', () => {
    expect(
      normalizeIdentifyResult({ status: 'nomatch', message: 'No match (audd)' }),
    ).toEqual({ status: 'nomatch', message: null });
    expect(
      normalizeIdentifyResult({ status: 'skipped', message: 'Could not extract' }),
    ).toEqual({ status: 'skipped', message: null });
  });

  it('maps legacy no-match errors to nomatch without message', () => {
    expect(
      normalizeIdentifyResult({ status: 'error', message: 'No match (audd)' }),
    ).toEqual({ status: 'nomatch', message: null });
    expect(
      normalizeIdentifyResult({ status: 'error', message: 'ACRCloud returned no match (code 1001)' }),
    ).toEqual({ status: 'nomatch', message: null });
  });

  it('keeps fatal configuration errors', () => {
    const r = normalizeIdentifyResult({
      status: 'error',
      message: 'Song ID is not configured. Set ACRCLOUD_HOST',
    });
    expect(r.status).toBe('error');
    expect(r.status === 'error' && r.message).toMatch(/not configured/i);
  });
});

describe('isFatalSongIdentifyError', () => {
  it('detects rate limits and missing config', () => {
    expect(
      isFatalSongIdentifyError({
        status: 'error',
        message: 'Too many song lookups — wait a moment',
      }),
    ).toBe(true);
  });
});
