/**
 * Call only from a direct user gesture (e.g. Capture / Continue tap).
 * Starts the location prompt in the same synchronous turn as the call when possible.
 */
import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp } from '@/react-app/lib/native-bridge';

export type PrimedCaptureGeo = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

/** Geolocation requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or localhost). Chrome will not show a prompt on plain HTTP LAN URLs. */
export function isGeolocationSecureContext(): boolean {
  return typeof window === 'undefined' || window.isSecureContext;
}

async function primeNativeGeolocationOnUserGesture(): Promise<PrimedCaptureGeo | null> {
  try {
    const permissions = await Geolocation.requestPermissions();
    const locationState = permissions.location ?? permissions.coarseLocation;
    if (locationState === 'denied') {
      return null;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch (err) {
    console.warn('primeNativeGeolocationOnUserGesture failed:', err);
    return null;
  }
}

export function primeGeolocationOnUserGesture(): Promise<PrimedCaptureGeo | null> {
  if (isNativeApp()) {
    return primeNativeGeolocationOnUserGesture();
  }

  if (!isGeolocationSecureContext()) {
    return Promise.resolve(null);
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: PrimedCaptureGeo | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          finish({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => finish(null),
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    } catch {
      finish(null);
    }
  });
}
