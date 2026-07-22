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
  // App Store release with bundled dist/: comment out `url` and run `npm run cap:sync ios`.
  server: {
    androidScheme: 'https',
    url: 'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev',
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
