/**
 * Instant Non-Blocking Geolocation Resolver
 * Resolves immediately with cached position or fast 300ms attempt to ensure sub-second SOS triggering.
 */

export interface GeoLocationResult {
  latitude: number | null;
  longitude: number | null;
  location_available: boolean;
  city?: string;
  source?: 'browser_gps' | 'fallback';
}

export async function getAccurateLocation(): Promise<GeoLocationResult> {
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 400, // Instant 400ms max wait
          enableHighAccuracy: false,
          maximumAge: 300000, // Use recent 5-min cached GPS fix if available for 0ms response
        });
      });
      if (pos?.coords?.latitude && pos?.coords?.longitude) {
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_available: true,
          source: 'browser_gps',
        };
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return {
    latitude: null,
    longitude: null,
    location_available: false,
    source: 'fallback',
  };
}
