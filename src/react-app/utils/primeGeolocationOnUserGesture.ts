/**
 * Call only from a direct user gesture (e.g. Capture / Continue tap).
 * Starts the browser location prompt in the same synchronous turn as the call.
 */
export type PrimedCaptureGeo = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

/** Geolocation requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or localhost). Chrome will not show a prompt on plain HTTP LAN URLs. */
export function isGeolocationSecureContext(): boolean {
  return typeof window === 'undefined' || window.isSecureContext;
}

export function primeGeolocationOnUserGesture(): Promise<PrimedCaptureGeo | null> {
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
          /** Fresh fix so venue tagging matches this capture (cached coords skip re-prompt but still need prior grant). */
          maximumAge: 0,
        },
      );
    } catch {
      finish(null);
    }
  });
}
