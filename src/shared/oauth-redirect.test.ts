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

describe('isValidGoogleIosOAuthClientId', () => {
  it('accepts iOS OAuth client IDs', () => {
    expect(
      isValidGoogleIosOAuthClientId(
        '254629847229-nneb3tf32q119en80rn75nhanjel7gvf.apps.googleusercontent.com',
      ),
    ).toBe(true);
  });

  it('rejects Google API keys', () => {
    expect(isValidGoogleIosOAuthClientId('AIzaSyC1gXJbd5qmAq9vrl8P1yxiDILiMHZ5WfM')).toBe(false);
  });
});

describe('googleIosUrlSchemeFromClientId', () => {
  it('derives reversed URL scheme from iOS client ID', () => {
    expect(
      googleIosUrlSchemeFromClientId(
        '254629847229-nneb3tf32q119en80rn75nhanjel7gvf.apps.googleusercontent.com',
      ),
    ).toBe('com.googleusercontent.apps.254629847229-nneb3tf32q119en80rn75nhanjel7gvf');
  });

  it('returns null for API keys', () => {
    expect(googleIosUrlSchemeFromClientId('AIzaSyC1gXJbd5qmAq9vrl8P1yxiDILiMHZ5WfM')).toBeNull();
  });
});
