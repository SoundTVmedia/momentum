import { useState, useCallback } from 'react';

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city: string | null;
  state: string | null;
  country: string | null;
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Raw browser position (no reverse geocode). Used by onboarding / settings. */
  const getCurrentPosition = useCallback(
    () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          reject(new Error('Geolocation is not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
      }),
    []
  );

  const requestLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          reject(new Error('Geolocation is not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;

      let city: string | null = null;
      let state: string | null = null;
      let country: string | null = null;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        if (response.ok) {
          const data = await response.json();
          const address = data.address || {};
          city = address.city || address.town || address.village || null;
          state = address.state || null;
          country = address.country || null;
        }
      } catch {
        /* Nominatim blocked / offline — still return GPS for JamBase + resolve-show */
      }

      const result: GeolocationData = {
        latitude,
        longitude,
        accuracy,
        city,
        state,
        country,
      };
      setLocation(result);
      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  };

  return {
    location,
    loading,
    error,
    requestLocation,
    getCurrentPosition,
  };
}
