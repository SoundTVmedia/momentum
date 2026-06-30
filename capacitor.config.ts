import type { CapacitorConfig } from '@capacitor/cli';

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
      CFBundleURLTypes: [
        {
          CFBundleURLName: 'com.feedbacklive.app',
          CFBundleURLSchemes: ['com.feedbacklive.app'],
        },
      ],
    },
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
