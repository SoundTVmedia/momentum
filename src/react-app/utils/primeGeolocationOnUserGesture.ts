/**
 * Call only from a direct user gesture (click/tap). Geolocation prompts are
 * unreliable when getCurrentPosition runs later from useEffect without a gesture.
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
        maximumAge: 0,
      }
    );
  });
}
