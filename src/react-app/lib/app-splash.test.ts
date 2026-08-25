import { describe, expect, it } from 'vitest';
import { shouldSkipAppSplash, splashHideDelayMs } from '@/react-app/lib/app-splash';

describe('shouldSkipAppSplash', () => {
  it('shows splash on home and typical app routes', () => {
    expect(shouldSkipAppSplash('/')).toBe(false);
    expect(shouldSkipAppSplash('/discover')).toBe(false);
    expect(shouldSkipAppSplash('/auth')).toBe(false);
  });

  it('skips OAuth callback, password reset, and clip share redirects', () => {
    expect(shouldSkipAppSplash('/auth/callback')).toBe(true);
    expect(shouldSkipAppSplash('/auth/reset-password')).toBe(true);
    expect(shouldSkipAppSplash('/share/clip/42')).toBe(true);
  });
});

describe('splashHideDelayMs', () => {
  it('holds the remainder of 3 seconds after time already shown', () => {
    expect(splashHideDelayMs(0)).toBe(3000);
    expect(splashHideDelayMs(800)).toBe(2200);
    expect(splashHideDelayMs(3000)).toBe(0);
    expect(splashHideDelayMs(4500)).toBe(0);
  });
});
