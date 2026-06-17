import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.momentum.app',
  appName: 'Momentum',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    infoPlist: {
      NSPhotoLibraryAddUsageDescription:
        'Momentum saves your concert clips to Photos so you keep a copy on your device.',
      NSPhotoLibraryUsageDescription:
        'Momentum may access your photo library when you choose clips to upload.',
    },
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
