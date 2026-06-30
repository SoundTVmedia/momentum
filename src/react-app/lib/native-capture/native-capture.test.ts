import { describe, expect, it, vi } from 'vitest';

vi.mock('@/react-app/lib/native-bridge', () => ({
  isNativeApp: () => false,
  getNativePlatform: () => 'web',
}));

describe('shouldUseNativeIosCapture', () => {
  it('returns false on web', async () => {
    const { shouldUseNativeIosCapture } = await import('@/react-app/lib/native-capture');
    expect(shouldUseNativeIosCapture()).toBe(false);
  });
});
