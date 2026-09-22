#!/usr/bin/env node
/**
 * Warn when syncing iOS without GOOGLE_IOS_OAUTH_CLIENT_ID. Native Google Sign-In needs
 * GIDClientID + the reversed-client-id URL scheme in Info.plist or the SDK raises an
 * NSException; scripts/sync-ios-info-plist.mjs writes both at the end of `cap:sync`, and
 * the WebView only enables the SDK path when @feedback/app-build-config reports them.
 */
const clientId = process.env.GOOGLE_IOS_OAUTH_CLIENT_ID?.trim() ?? '';
const valid =
  clientId.length > '.apps.googleusercontent.com'.length &&
  clientId.endsWith('.apps.googleusercontent.com');

if (!valid) {
  console.warn(
    '[cap:sync] GOOGLE_IOS_OAUTH_CLIENT_ID is not set — iOS will use browser Google sign-in only.',
  );
  console.warn(
    '[cap:sync] To enable native Google Sign-In: export GOOGLE_IOS_OAUTH_CLIENT_ID=<same value as the Worker secret>, re-run npm run cap:sync, then archive a new TestFlight build.',
  );
}
