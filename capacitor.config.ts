import type { CapacitorConfig } from '@capacitor/cli';
import {
  googleIosUrlSchemeFromClientId,
  isValidGoogleIosOAuthClientId,
  NATIVE_APP_ID,
} from './src/shared/oauth-redirect';

const googleIosClientId = process.env.GOOGLE_IOS_OAUTH_CLIENT_ID?.trim() ?? '';
const googleIosUrlScheme = isValidGoogleIosOAuthClientId(googleIosClientId)
  ? googleIosUrlSchemeFromClientId(googleIosClientId)
  : null;

/** Live Worker by default. Override with CAPACITOR_SERVER_URL for on-device review of a local Vite server. */
const capServerUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev';
const capServerIsHttp = capServerUrl.startsWith('http://');

const iosUrlTypes: Array<{ CFBundleURLName: string; CFBundleURLSchemes: string[] }> = [
  {
    CFBundleURLName: NATIVE_APP_ID,
    CFBundleURLSchemes: [NATIVE_APP_ID],
  },
];
if (googleIosUrlScheme) {
  iosUrlTypes.push({
    CFBundleURLName: 'GoogleSignIn',
    CFBundleURLSchemes: [googleIosUrlScheme],
  });
}

const config: CapacitorConfig = {
  appId: 'com.feedbacklive.app',
  appName: 'Feedback',
  webDir: 'dist',
  // Live Workers URL: WebView loads from deploy — JS updates without a new TestFlight build.
  // IMPORTANT: all app APIs are relative /api/* fetches served by this Worker, so removing
  // `url` breaks login/feeds/uploads. To test branch-only native features (e.g. ShazamKit),
  // deploy this branch's Worker (`npm run deploy`) instead of commenting this out.
  // For on-device review of local Vite: CAPACITOR_SERVER_URL=http://<lan-ip>:5173 npm run cap:sync
  server: {
    androidScheme: 'https',
    url: capServerUrl,
    ...(capServerIsHttp ? { cleartext: true } : {}),
  },
  // Baked into ios/App/App/capacitor.config.json at sync — used to gate native Google SDK vs browser OAuth.
  ...(googleIosClientId ? { googleIosOAuthClientId: googleIosClientId } : {}),
  ios: {
    contentInset: 'automatic',
    infoPlist: {
      NSCameraUsageDescription:
        'Feedback uses the camera to record concert clips in the app.',
      NSMicrophoneUsageDescription:
        'Feedback uses the microphone to record concert audio and identify songs.',
      NSPhotoLibraryAddUsageDescription:
        'Feedback saves your concert clips to Photos so you keep a copy on your device.',
      NSPhotoLibraryUsageDescription:
        'Feedback may access your photo library when you choose clips to upload.',
      NSLocationWhenInUseUsageDescription:
        'Feedback uses your location to match concert clips to nearby venues and JamBase shows.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Feedback uses your location to match concert clips to nearby venues and JamBase shows.',
      UIBackgroundModes: ['audio'],
      ...(isValidGoogleIosOAuthClientId(googleIosClientId)
        ? { GIDClientID: googleIosClientId }
        : {}),
      CFBundleURLTypes: iosUrlTypes,
    },
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SocialLogin: {
      providers: {
        google: true,
        apple: false,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
