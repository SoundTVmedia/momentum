import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acrCloudExhaustedReason,
  isAcrCloudExhaustedMessage,
  isAcrCloudFallbackAvailable,
  isAcrCloudMisconfiguredMessage,
  markAcrCloudExhausted,
  resetIdentifyMusicConfigCache,
} from './identify-music-config';

function configResponse(ready: boolean): Response {
  return new Response(
    JSON.stringify({
      activeProvider: ready ? 'acrcloud' : 'none',
      acrcloud: { ready },
      hint: ready ? null : 'Set ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET.',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('isAcrCloudExhaustedMessage', () => {
  it('detects ACRCloud quota and rate-limit codes', () => {
    expect(isAcrCloudExhaustedMessage('ACRCloud request quota exceeded (code 3003).')).toBe(true);
    expect(isAcrCloudExhaustedMessage('ACRCloud rate limit exceeded (code 3015).')).toBe(true);
  });

  it('leaves our own Worker throttle alone — waiting clears that one', () => {
    expect(isAcrCloudExhaustedMessage('Too many song lookups — wait a moment')).toBe(false);
  });

  it('ignores plain no-match text', () => {
    expect(isAcrCloudExhaustedMessage('No match in ACRCloud catalog (code 1001)')).toBe(false);
    expect(isAcrCloudExhaustedMessage(null)).toBe(false);
  });
});

describe('isAcrCloudMisconfiguredMessage', () => {
  it('detects bad keys and rejected signatures', () => {
    expect(isAcrCloudMisconfiguredMessage('Invalid ACRCloud access key (code 3001)')).toBe(true);
    expect(isAcrCloudMisconfiguredMessage('ACRCloud signature rejected (code 3014)')).toBe(true);
    expect(isAcrCloudMisconfiguredMessage('Song ID is not configured.')).toBe(true);
  });
});

describe('isAcrCloudFallbackAvailable', () => {
  beforeEach(() => {
    resetIdentifyMusicConfigCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetIdentifyMusicConfigCache();
  });

  it('is available when the Worker reports ACRCloud keys', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => configResponse(true)));
    await expect(isAcrCloudFallbackAvailable()).resolves.toBe(true);
  });

  it('is unavailable when the Worker has no keys', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => configResponse(false)));
    await expect(isAcrCloudFallbackAvailable()).resolves.toBe(false);
  });

  it('caches the probe instead of asking on every clip', async () => {
    const fetchMock = vi.fn(async () => configResponse(true));
    vi.stubGlobal('fetch', fetchMock);
    await isAcrCloudFallbackAvailable();
    await isAcrCloudFallbackAvailable();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops offering the fallback once the quota is reported spent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => configResponse(true)));
    await expect(isAcrCloudFallbackAvailable()).resolves.toBe(true);
    markAcrCloudExhausted('ACRCloud request quota exceeded (code 3003).');
    await expect(isAcrCloudFallbackAvailable()).resolves.toBe(false);
    expect(acrCloudExhaustedReason()).toMatch(/3003/);
  });

  it('treats an unreachable config endpoint as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(isAcrCloudFallbackAvailable()).resolves.toBe(false);
  });
});
