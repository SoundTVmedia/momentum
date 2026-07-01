import { describe, expect, it } from 'vitest';
import {
  normalizeOAuthCallbackUrl,
  OAUTH_CALLBACK_PATH,
  resolveAppleOAuthCallbackUrl,
  normalizeGoogleIosClientId,
  googleIosUrlSchemeFromClientId,
} from './oauth-redirect';

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

describe('resolveAppleOAuthCallbackUrl', () => {
  it('appends Apple worker callback path to origin', () => {
    expect(resolveAppleOAuthCallbackUrl('https://app.example')).toBe(
      'https://app.example/api/auth/apple/callback',
    );
  });
});

describe('normalizeGoogleIosClientId', () => {
  it('accepts full Google iOS client ids', () => {
    expect(normalizeGoogleIosClientId('abc123.apps.googleusercontent.com')).toBe(
      'abc123.apps.googleusercontent.com',
    );
  });

  it('appends the googleusercontent suffix to bare hashes', () => {
    expect(normalizeGoogleIosClientId('abc123')).toBe('abc123.apps.googleusercontent.com');
  });
});

describe('googleIosUrlSchemeFromClientId', () => {
  it('returns the reversed client id scheme', () => {
    expect(googleIosUrlSchemeFromClientId('abc123.apps.googleusercontent.com')).toBe(
      'com.googleusercontent.apps.abc123',
    );
    expect(googleIosUrlSchemeFromClientId('abc123')).toBe('com.googleusercontent.apps.abc123');
  });
});
