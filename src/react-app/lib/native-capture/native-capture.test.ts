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

describe('CAPTURE_IDLE_STOP_MS', () => {
  it('stops idle preview after 10s', async () => {
    const { CAPTURE_IDLE_STOP_MS } = await import('@/react-app/lib/native-capture');
    expect(CAPTURE_IDLE_STOP_MS).toBe(10_000);
  });
});
