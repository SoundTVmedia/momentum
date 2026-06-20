/** Build `/api/shows/nearby` with optional device GPS so listings match where you are now. */
export function nearbyShowsApiUrl(
  params: { limit?: number; radiusMiles?: number; latitude?: number; longitude?: number } = {},
): string {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.radiusMiles != null) qs.set('radius_miles', String(params.radiusMiles));
  if (params.latitude != null && params.longitude != null) {
    qs.set('latitude', String(params.latitude));
    qs.set('longitude', String(params.longitude));
  }
  const q = qs.toString();
  return q ? `/api/shows/nearby?${q}` : '/api/shows/nearby';
}

/** Build `/api/shows/tonight` with optional device GPS. */
export function tonightShowsApiUrl(
  params: { limit?: number; radiusMiles?: number; latitude?: number; longitude?: number } = {},
): string {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.radiusMiles != null) qs.set('radius_miles', String(params.radiusMiles));
  if (params.latitude != null && params.longitude != null) {
    qs.set('latitude', String(params.latitude));
    qs.set('longitude', String(params.longitude));
  }
  const q = qs.toString();
  return q ? `/api/shows/tonight?${q}` : '/api/shows/tonight';
}

/** Best-effort browser GPS for nearby show feeds (non-blocking, cached up to 60s). */
export async function readDeviceCoordsForNearbyShows(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}
