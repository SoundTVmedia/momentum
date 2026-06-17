import { describe, expect, it, vi } from 'vitest';
import { formatUploadError, isRetryableUploadError } from './blob-store';

describe('formatUploadError', () => {
  it('returns offline message when navigator is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(formatUploadError(new TypeError('Failed to fetch'))).toMatch(/offline/i);
    vi.unstubAllGlobals();
  });

  it('returns connection message for fetch failures', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(formatUploadError(new TypeError('Failed to fetch'))).toMatch(/retry when you're back online/i);
    vi.unstubAllGlobals();
  });
});

describe('isRetryableUploadError', () => {
  it('retries offline failures', () => {
    expect(isRetryableUploadError("You're offline. We'll retry when you're back online.")).toBe(true);
  });

  it('does not retry missing device storage', () => {
    expect(isRetryableUploadError('Clip video is not on this device anymore.')).toBe(false);
  });
});
