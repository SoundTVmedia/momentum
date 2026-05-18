import { describe, expect, it } from 'vitest';
import { normalizeOAuthCallbackUrl, OAUTH_CALLBACK_PATH } from './oauth-redirect';

describe('normalizeOAuthCallbackUrl', () => {
  it('appends callback path to origin', () => {
    expect(normalizeOAuthCallbackUrl('http://localhost:5173')).toBe(
      'http://localhost:5173/auth/callback',
    );
  });

  it('does not double-append callback path', () => {
    expect(normalizeOAuthCallbackUrl('https://app.example/auth/callback')).toBe(
      'https://app.example/auth/callback',
    );
  });

  it('strips trailing slash before appending', () => {
    expect(normalizeOAuthCallbackUrl('https://app.example/')).toBe(
      'https://app.example/auth/callback',
    );
  });

  it('returns bare path when base is empty', () => {
    expect(normalizeOAuthCallbackUrl('')).toBe(OAUTH_CALLBACK_PATH);
  });
});
