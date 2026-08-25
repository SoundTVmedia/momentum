import { describe, expect, it } from 'vitest';
import { shouldSkipAppSplash } from '@/react-app/lib/app-splash';

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
