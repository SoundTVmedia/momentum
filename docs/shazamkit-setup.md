# ShazamKit song recognition (iOS)

Both iOS apps identify the song in a captured clip with **Apple ShazamKit
on-device as the primary provider**. The Worker's ACRCloud endpoint
(`POST /api/clips/identify-music`) remains the **fallback** for web
browsers/Android, iOS < 15, binaries built before the plugin existed, and any
ShazamKit no-match or error.

| App | Bundle ID | Native code |
|-----|-----------|-------------|
| Capacitor (production) | `com.feedbacklive.app` | `packages/shazamkit` Capacitor plugin |
| RN migration (`apps/mobile`) | `com.feedbacklive.app.rn` | `apps/mobile/modules/feedback-shazamkit` Expo module |

## Capacitor app (production) — how it works

1. All clip song ID funnels through `identifyMusicForClip`
   (`src/react-app/utils/auddIdentify.ts`): the caption screen, the quick
   record button, the upload outbox (`identify-for-upload.ts`), and uploaded
   clips. ShazamKit now runs first there
   (`src/react-app/utils/shazamKitIdentify.ts`); no-match/error falls through
   to the existing ACRCloud ladder.
2. Native iOS quick-capture uses `ShazamKit.recognizeFile({ path })` on the
   recorded MP4 (muxed audio track) so the WebView never base64s a 20–40MB
   movie. Other paths pick the cheapest audio source for the Capacitor bridge:
   parallel mic capture (AAC), else an 11s mono WAV extracted with WebAudio
   (Shazam catalog signatures must be **>1s and <12s** — SHError 201 if
   longer), else the whole video when small.
3. The Swift plugin (`ShazamKitPlugin.swift`) reads the audio track with
   `AVAssetReader` (first 11s), generates a signature with
   `SHSignatureGenerator`, and matches via `SHSession`.
4. **Quick capture HUD**: while recording, 8s mic segments run **ShazamKit
   only** (no live ACR). A match shows as `♪ title` on the camera HUD and is
   attached to the clip at enqueue. If live ID misses, the upload outbox runs
   ShazamKit then ACRCloud and patches `song_title` as before.

### Capacitor build steps

```bash
npm install                # links @feedback/shazamkit (file:packages/shazamkit)
npx cap sync ios           # copies web assets + refreshes pods
# open ios/App/App.xcworkspace in Xcode and build (pod install runs via cap sync)
```

The pod is registered in `ios/App/Podfile`
(`FeedbackShazamkit` — the name Capacitor derives from `@feedback/shazamkit`;
lowercase "kit" is required). `Podfile.lock` updates on the next `pod install`
on macOS.

Do **not** put `com.apple.developer.shazamkit` in `App.entitlements` — Apple
does not treat that key as a real entitlement, and Xcode will refuse to include
it in the provisioning profile. Enable the **ShazamKit App Service** on the
App ID instead (see below).

### Critical: `server.url` and ShazamKit JS

`capacitor.config.ts` sets `server.url` to the live Workers app, and **must
stay set**: every API call in the app is a relative `/api/*` fetch served by
that Worker. Commenting out `server.url` makes the WebView load from
`capacitor://localhost`, where those fetches have no backend — login, feeds,
and uploads all break.

The native ShazamKit plugin only runs when the **JS loaded by the WebView**
calls it. Production JS on the Worker gains ShazamKit only when this branch
is deployed. So to test ShazamKit on a physical iPhone:

1. Keep `server.url` set (do not comment it out).
2. Deploy this branch's Worker so the WebView JS includes ShazamKit:
   `npm run deploy` (from this branch, on a machine with Cloudflare auth).
3. Build/refresh the native app so the plugin is in the binary:
   `npx cap sync ios`, then run from `ios/App/App.xcworkspace`
   on a **physical** iPhone (iOS 15+).
4. Force-quit and reopen the app so the WebView pulls the fresh Worker JS.
5. In Safari → Develop → [your iPhone] → WebView console, a capture logs
   either a ShazamKit match or `ShazamKit identify failed …` (not silence).

Also required at runtime: network access (Shazam catalog is remote) and the
ShazamKit **App Service** enabled on `com.feedbacklive.app`.

**HUD + upload identify on this branch**

- While recording, ShazamKit runs on ~8s AAC segments (signatures stay under
  12s). A match appears on the camera HUD; ACR is not called during capture.
- If live ShazamKit misses, the outbox runs ShazamKit→ACR before upload and
  again after publish (PATCH `/api/clips/update-own`).
- Manual / library uploads identify on the clip details (`UploadClip`) screen
  before Share via the same `identifyMusicForClip` ladder.

### Troubleshooting: `objectVersion 70` / `pod install` fails

CocoaPods **1.16.2** ships `xcodeproj` **1.27.0**, which does **not** map Xcode
project `objectVersion = 70` (it does map `56` and `77`). CocoaPods copies the
**App** project’s object version when generating `Pods.xcodeproj`, so if Xcode
left yours at 70, `pod install` dies with:

```text
ArgumentError - [Xcodeproj] Unable to find compatibility version string for object version `70`.
```

`ios/App/Podfile` patches the missing mapping and rewrites `70 → 56` on disk
before install. Pull that Podfile, then sync again.

**Immediate unblock (no pull):**

```bash
# Quit Xcode first so it does not rewrite the file
sed -i '' 's/objectVersion = 70;/objectVersion = 56;/' ios/App/App.xcodeproj/project.pbxproj
grep objectVersion ios/App/App.xcodeproj/project.pbxproj | head -1   # expect 56
cd ios/App && pod install && cd ../..
# or: npx cap sync ios
```

Also: prefer **New Group** over **New Folder** in Xcode, and set Project Format
to Xcode 14 (or Xcode 16 → objectVersion 77) so it does not keep saving as 70.

## RN app (`apps/mobile`) — how it works

1. Capture records an MP4 and writes a `CaptureHandoff` (unchanged).
2. The `/upload` review screen runs recognition **once per pending capture**
   (`apps/mobile/src/lib/music/recognize-capture.ts`) and stores the outcome on
   the handoff (`musicRecognition`), so remounting the screen doesn't re-run it.
3. On iOS the native module `apps/mobile/modules/feedback-shazamkit` reads the
   clip's audio track with `AVAssetReader`, feeds up to 11s of PCM into
   `SHSignatureGenerator`, and matches the signature via `SHSession`.
4. A match prefills the **Song** and **Artist** fields — only when they are
   still empty; user-edited values are never overwritten.
5. Recognition failure/no-match never blocks **Share**; the review screen shows
   "Identifying song…", "Song identified: …", "No song match…", or an error
   with a **Retry** action.

Key files:

- `apps/mobile/modules/feedback-shazamkit/` — Expo native module (Swift,
  ShazamKit + AVFoundation)
- `apps/mobile/src/lib/music/shazamkit.ts` — `isShazamKitAvailable()`,
  `recognizeSongFromVideo(fileUri)`
- `apps/mobile/src/lib/music/recognition.ts` — pure normalization / prefill /
  fallback helpers (vitest-covered in `recognition.test.ts`)
- `apps/mobile/src/lib/music/recognize-capture.ts` — provider orchestration +
  ACRCloud Worker fallback

## Apple Developer setup (one-time, manual)

Enable the **ShazamKit App Service** on each App ID (this is not an
entitlements-file key):

1. Sign in at [developer.apple.com](https://developer.apple.com/account) →
   **Certificates, Identifiers & Profiles → Identifiers**.
2. Open the App ID — `com.feedbacklive.app` for the Capacitor production app,
   and `com.feedbacklive.app.rn` for the RN migration app.
3. Under **App Services** (not Capabilities), enable **ShazamKit** and save.
4. Let Xcode refresh the provisioning profile on the next build (or regenerate
   manual profiles).

Do **not** add `com.apple.developer.shazamkit` to any `.entitlements` plist or
to `apps/mobile/app.json` → `expo.ios.entitlements`. Xcode reports that key as
invalid ("Entitlement … not found and could not be included in profile").
Default-catalog matching works by linking the ShazamKit framework and enabling
the App Service on the App ID.

No ShazamKit API key is needed — matching against the Shazam catalog is free
with an Apple Developer membership.

## Building (RN app)

Native code changed, so JS-only updates are not enough — rebuild the dev
client/app:

```bash
npm run mobile:install       # links modules/feedback-shazamkit
npm run mobile:ios           # expo run:ios — prebuilds + compiles the Swift module
# or with EAS:
cd apps/mobile && npx eas build --platform ios --profile development
```

Verify after prebuild that the entitlement landed:

```bash
cd apps/mobile && npx expo prebuild --platform ios
# Confirm no invalid ShazamKit entitlement was written:
grep -i shazamkit ios/FeedbackRN/FeedbackRN.entitlements || echo 'OK: no shazamkit entitlement'
```

Test on a **physical iPhone (iOS 15+)** — the simulator has no useful
microphone-captured content and ShazamKit matching needs a network connection
to the Shazam catalog service.

## Fallback configuration (ACRCloud, optional)

The Worker-side ACRCloud config is unchanged (`ACRCLOUD_HOST`,
`ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET` — see `.dev.vars.example`).
Without it, iOS still identifies songs via ShazamKit; other platforms show
"Song ID is unavailable on this device" and manual entry still works.

## Error surface (native modules)

Both native implementations reject with the same coded errors
(`recognizeFromFile` in the Expo module, `recognizeAudio` in the Capacitor
plugin), which the JS layers convert into non-blocking states:

| Code | Meaning |
|------|---------|
| `ERR_SHAZAMKIT_UNAVAILABLE` | iOS < 15 |
| `ERR_SHAZAMKIT_BAD_FILE` / `ERR_SHAZAMKIT_FILE_NOT_FOUND` | Malformed or missing recording |
| `ERR_SHAZAMKIT_NO_AUDIO_TRACK` | No/too-short audio track |
| `ERR_SHAZAMKIT_SIGNATURE` | Signature generation failed |
| `ERR_SHAZAMKIT_SIGNATURE_DURATION` | Signature longer than 12s (SHError 201) — not retried |
| `ERR_SHAZAMKIT_MATCH_FAILED` | Match attempt failed (network, or SHError 202) |

A clean catalog no-match resolves `null` (not an error).
