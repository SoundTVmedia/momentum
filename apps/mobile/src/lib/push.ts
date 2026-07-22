import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushRegistrationResult = {
  granted: boolean;
  status: Notifications.PermissionStatus;
  expoPushToken: string | null;
  /** Device APNs/FCM token when available — Worker upload not wired yet (same gap as Capacitor). */
  devicePushToken: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permission and register for remote notifications.
 * Mirrors Capacitor `registerNativePush` (permission + register only; no Worker token POST yet).
 */
export async function registerNativePush(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return {
      granted: false,
      status: Notifications.PermissionStatus.DENIED,
      expoPushToken: null,
      devicePushToken: null,
    };
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return {
      granted: false,
      status,
      expoPushToken: null,
      devicePushToken: null,
    };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let expoPushToken: string | null = null;
  let devicePushToken: string | null = null;
  try {
    const device = await Notifications.getDevicePushTokenAsync();
    devicePushToken = typeof device.data === 'string' ? device.data : String(device.data);
  } catch {
    devicePushToken = null;
  }

  try {
    const expo = await Notifications.getExpoPushTokenAsync();
    expoPushToken = expo.data;
  } catch {
    // Expo push token needs EAS projectId for some setups; device token alone is enough for Phase 2.
    expoPushToken = null;
  }

  return {
    granted: true,
    status,
    expoPushToken,
    devicePushToken,
  };
}
