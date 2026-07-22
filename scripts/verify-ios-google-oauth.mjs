#!/usr/bin/env node
/**
 * Warn when syncing iOS without GOOGLE_IOS_OAUTH_CLIENT_ID — native Google Sign-In
 * needs GIDClientID + reversed URL scheme in Info.plist or the SDK hard-crashes.
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
    '[cap:sync] To enable native Google Sign-In: export GOOGLE_IOS_OAUTH_CLIENT_ID=... then re-run cap sync and archive a new TestFlight build.',
  );
}
