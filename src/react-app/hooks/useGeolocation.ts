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
      // Request browser geolocation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Reverse geocode using Nominatim (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );

      if (!response.ok) {
        throw new Error('Failed to reverse geocode location');
      }

      const data = await response.json();
      const address = data.address || {};

      setLocation({
        latitude,
        longitude,
        accuracy,
        city: address.city || address.town || address.village || null,
        state: address.state || null,
        country: address.country || null,
      });

      setLoading(false);
      return {
        latitude,
        longitude,
        accuracy,
        city: address.city || address.town || address.village || null,
        state: address.state || null,
        country: address.country || null,
      };
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
