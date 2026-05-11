/**
 * Call only from a direct user gesture (e.g. Capture / Re-record tap).
 * Starts the browser location prompt in the same task as camera priming.
 */
export type PrimedCaptureGeo = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export function primeGeolocationOnUserGesture(): Promise<PrimedCaptureGeo | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
}
