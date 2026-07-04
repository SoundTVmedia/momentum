import { describe, expect, it } from 'vitest';
import {
  googleIosUrlSchemeFromClientId,
  isValidGoogleIosOAuthClientId,
  normalizeOAuthCallbackUrl,
  OAUTH_CALLBACK_PATH,
  resolveAppleOAuthCallbackUrl,
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

/** Synthetic values for unit tests — never commit real Google API keys or OAuth client IDs. */
const FAKE_IOS_OAUTH_CLIENT_ID =
  '123456789-fakeiosclientidforunittests.apps.googleusercontent.com';
const FAKE_GOOGLE_API_KEY = `AIza${'Sy'}${'0'.repeat(33)}`;

describe('isValidGoogleIosOAuthClientId', () => {
  it('accepts iOS OAuth client IDs', () => {
    expect(isValidGoogleIosOAuthClientId(FAKE_IOS_OAUTH_CLIENT_ID)).toBe(true);
  });

  it('rejects Google API keys', () => {
    expect(isValidGoogleIosOAuthClientId(FAKE_GOOGLE_API_KEY)).toBe(false);
  });
});

describe('googleIosUrlSchemeFromClientId', () => {
  it('derives reversed URL scheme from iOS client ID', () => {
    expect(googleIosUrlSchemeFromClientId(FAKE_IOS_OAUTH_CLIENT_ID)).toBe(
      'com.googleusercontent.apps.123456789-fakeiosclientidforunittests',
    );
  });

  it('returns null for API keys', () => {
    expect(googleIosUrlSchemeFromClientId(FAKE_GOOGLE_API_KEY)).toBeNull();
  });
});
