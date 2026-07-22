# Feedback RN (Expo)

Isolated React Native / Expo track for migrating Feedback off Capacitor WebView.
**Production mobile remains Capacitor** (`com.feedbacklive.app`) until an explicit cutover.

## Identity

| | Capacitor (prod) | This app (migration) |
|--|------------------|----------------------|
| Bundle ID | `com.feedbacklive.app` | `com.feedbacklive.app.rn` |
| Display name | Feedback | Feedback RN |
| URL scheme | `com.feedbacklive.app://` | `com.feedbacklive.app.rn://` |
| Google iOS client | `GOOGLE_IOS_OAUTH_CLIENT_ID` | `GOOGLE_IOS_OAUTH_CLIENT_ID_RN` |
| Google URL scheme | (Cap sync) | `com.googleusercontent.apps.254629847229-1ge9jdqj2l6j09n7o67pump5pfo8giki` |

## Commands

```bash
npm run mobile:install
npm run mobile:ios          # rebuild when native modules change
npm run mobile:ios:start    # Metro only
npm run mobile:lint
```

## Phase 4 — capture + upload (device QA required)

**Stack**
- `react-native-vision-camera` — rear camera + muxed mic → MP4 file
- `modules/feedback-audio-session` — AVAudioSession prepare/restore (Capacitor plugin left intact)
- File-based handoff + AsyncStorage outbox meta (no IndexedDB)
- Worker multipart: `POST /api/uploads/init` → PUT parts → complete → poll published
- Photos save via `expo-media-library`
- Pending capture recovery on boot / queue tab

**Flow**
1. Capture tab → record ≤60s → audio atom assert → persist under Documents/captures
2. `/upload` review (caption/artist/venue) → Share
3. Queue uploads + Photos save → clip appears in feed via existing Worker

**Rebuild after Phase 4**
```bash
npm run mobile:ios
```
Must validate on a **physical iPhone** (simulator camera/mic is insufficient).

**Deferred vs Capacitor (Phase 5+)**
- Live AudD while recording
- Zoom-while-record / flip
- Content-feed classify + ACR at upload time (manual caption fields for now)
- Capgo-specific settle timings / multi-clip sticky show session

## Phase status

- [x] Phase 1 — Expo scaffold
- [x] Phase 2 — auth / API / push / location / theme
- [x] Phase 3 — nav + read-only feeds
- [x] Phase 4 — native capture + upload outbox (device QA pending)
- [ ] Phase 5 — hardening
- [ ] Phase 6 — cutover (explicit approval)

## Collision avoidance

- Do not change Capacitor `ios/`, `android/`, or `capacitor.config.ts` for RN work
- Capacitor `@feedback/native-audio-capture` package stays untouched
