import type { CapacitorConfig } from '@capacitor/cli';
import {
  googleIosUrlSchemeFromClientId,
  normalizeGoogleIosClientId,
  NATIVE_APP_ID,
} from './src/shared/oauth-redirect';

const googleIosClientId =
  normalizeGoogleIosClientId(process.env.GOOGLE_IOS_OAUTH_CLIENT_ID ?? '') ?? '';
const googleIosUrlScheme = googleIosClientId
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
  server: {
    androidScheme: 'https',
    url: 'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev',
  },
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
      ...(googleIosClientId ? { GIDClientID: googleIosClientId } : {}),
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
