import * as Location from 'expo-location';

export type DeviceCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

/**
 * Prime location permission on a user gesture (nearby/tonight / capture geo).
 * Mirrors Capacitor `primeGeolocationOnUserGesture` intent.
 */
export async function primeLocationOnUserGesture(): Promise<{
  granted: boolean;
  coords: DeviceCoords | null;
  status: Location.PermissionStatus;
}> {
  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== Location.PermissionStatus.GRANTED) {
    return { granted: false, coords: null, status };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      granted: true,
      status,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
    };
  } catch {
    return { granted: true, coords: null, status };
  }
}

export async function readDeviceCoordsForNearbyShows(): Promise<DeviceCoords | null> {
  const { granted, coords } = await primeLocationOnUserGesture();
  return granted ? coords : null;
}
