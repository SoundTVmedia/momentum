import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script; vitest resolves it without a declaration file.
import { mergeInfoPlist } from '../../../scripts/sync-ios-info-plist.mjs';

const CLIENT_ID = '1234567890-abcdefg.apps.googleusercontent.com';
const GOOGLE_SCHEME = 'com.googleusercontent.apps.1234567890-abcdefg';

const baseInfo = {
  CFBundleDisplayName: 'Feedback',
  NSCameraUsageDescription: 'old camera text',
  CFBundleURLTypes: [
    { CFBundleURLName: 'com.feedbacklive.app', CFBundleURLSchemes: ['com.feedbacklive.app'] },
  ],
};

describe('mergeInfoPlist', () => {
  it('writes declared keys and leaves unmanaged Xcode keys alone', () => {
    const { plist, changed } = mergeInfoPlist(baseInfo, {
      NSCameraUsageDescription: 'new camera text',
      UIBackgroundModes: ['audio'],
    });
    expect(plist.CFBundleDisplayName).toBe('Feedback');
    expect(plist.NSCameraUsageDescription).toBe('new camera text');
    expect(plist.UIBackgroundModes).toEqual(['audio']);
    expect(changed.sort()).toEqual(['NSCameraUsageDescription', 'UIBackgroundModes']);
  });

  it('adds GIDClientID and the Google URL scheme when the config sets them', () => {
    const { plist } = mergeInfoPlist(baseInfo, {
      GIDClientID: CLIENT_ID,
      CFBundleURLTypes: [
        ...baseInfo.CFBundleURLTypes,
        { CFBundleURLName: 'GoogleSignIn', CFBundleURLSchemes: [GOOGLE_SCHEME] },
      ],
    });
    expect(plist.GIDClientID).toBe(CLIENT_ID);
    expect(plist.CFBundleURLTypes).toHaveLength(2);
  });

  it('removes a stale GIDClientID when the config no longer sets it', () => {
    // Otherwise a binary synced without GOOGLE_IOS_OAUTH_CLIENT_ID would still
    // advertise a client id and the SDK path could be re-enabled without its scheme.
    const { plist, changed } = mergeInfoPlist(
      { ...baseInfo, GIDClientID: CLIENT_ID },
      { CFBundleURLTypes: baseInfo.CFBundleURLTypes },
    );
    expect(plist.GIDClientID).toBeUndefined();
    expect(changed).toEqual(['GIDClientID']);
  });

  it('reports no change when Info.plist already matches', () => {
    const { changed } = mergeInfoPlist(baseInfo, {
      NSCameraUsageDescription: 'old camera text',
      CFBundleURLTypes: baseInfo.CFBundleURLTypes,
    });
    expect(changed).toEqual([]);
  });
});
