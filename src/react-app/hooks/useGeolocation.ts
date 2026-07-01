import { useState, useCallback } from 'react';
import { isNativeApp } from '@/react-app/lib/native-bridge';
import { readDeviceCoordsForNearbyShows } from '@/react-app/lib/nearby-shows-url';

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
          timeout: 10000,
          maximumAge: 60000,
        });
      }),
    []
  );

  /** Device GPS (Capacitor on native shell). Best for capture / JamBase lat–lon matching. */
  const getDeviceCoordinates = useCallback(async (): Promise<GeolocationData | null> => {
    if (isNativeApp()) {
      const coords = await readDeviceCoordsForNearbyShows();
      if (!coords) return null;
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: undefined,
        city: null,
        state: null,
        country: null,
      };
    }

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, accuracy } = position.coords;
      return {
        latitude,
        longitude,
        accuracy,
        city: null,
        state: null,
        country: null,
      };
    } catch {
      return null;
    }
  }, [getCurrentPosition]);

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

  const ingestCaptureGeo = useCallback((g: GeolocationData) => {
    setLocation(g);
  }, []);

  return {
    location,
    loading,
    error,
    requestLocation,
    getCurrentPosition,
    getDeviceCoordinates,
    ingestCaptureGeo,
  };
}
