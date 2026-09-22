import { describe, expect, it } from 'vitest';
import {
  builtGoogleIosOAuthClientIdFromConfig,
  nativeGoogleSdkMatchesServerConfig,
} from './native-oauth';

const CLIENT_ID = '1234567890-abcdefg.apps.googleusercontent.com';
const SCHEME = 'com.googleusercontent.apps.1234567890-abcdefg';

describe('builtGoogleIosOAuthClientIdFromConfig', () => {
  it('returns the client id only when its URL scheme is compiled into the binary', () => {
    expect(
      builtGoogleIosOAuthClientIdFromConfig({
        iosClientId: CLIENT_ID,
        urlScheme: SCHEME,
        urlSchemeRegistered: true,
      }),
    ).toBe(CLIENT_ID);
  });

  it('treats a client id without its URL scheme as not built in (GoogleSignIn would crash)', () => {
    expect(
      builtGoogleIosOAuthClientIdFromConfig({
        iosClientId: CLIENT_ID,
        urlScheme: SCHEME,
        urlSchemeRegistered: false,
      }),
    ).toBeNull();
  });

  it('rejects binaries without GIDClientID, API keys, and missing plugin results', () => {
    expect(
      builtGoogleIosOAuthClientIdFromConfig({
        iosClientId: null,
        urlScheme: null,
        urlSchemeRegistered: false,
      }),
    ).toBeNull();
    expect(
      builtGoogleIosOAuthClientIdFromConfig({
        iosClientId: 'AIzaSyNotAClientId',
        urlScheme: null,
        urlSchemeRegistered: true,
      }),
    ).toBeNull();
    expect(builtGoogleIosOAuthClientIdFromConfig(null)).toBeNull();
    expect(builtGoogleIosOAuthClientIdFromConfig(undefined)).toBeNull();
  });
});

describe('nativeGoogleSdkMatchesServerConfig', () => {
  const server = { enabled: true, webClientId: 'web.apps.googleusercontent.com', iOSClientId: CLIENT_ID };

  it('enables the SDK only when the Worker and the binary agree on the iOS client id', () => {
    expect(nativeGoogleSdkMatchesServerConfig(server, CLIENT_ID)).toBe(true);
    expect(nativeGoogleSdkMatchesServerConfig({ ...server, iOSClientId: ` ${CLIENT_ID} ` }, CLIENT_ID)).toBe(
      true,
    );
  });

  it('falls back to browser OAuth when the binary has no usable client id', () => {
    expect(nativeGoogleSdkMatchesServerConfig(server, null)).toBe(false);
  });

  it('falls back when the ids differ or the Worker disabled native sign-in', () => {
    expect(
      nativeGoogleSdkMatchesServerConfig(server, 'other-id.apps.googleusercontent.com'),
    ).toBe(false);
    expect(nativeGoogleSdkMatchesServerConfig({ ...server, enabled: false }, CLIENT_ID)).toBe(false);
    expect(nativeGoogleSdkMatchesServerConfig({ ...server, iOSClientId: null }, CLIENT_ID)).toBe(false);
  });
});
