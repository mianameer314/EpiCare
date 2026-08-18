/**
 * Geolocation Resolver with multiple fallbacks:
 * 1. Browser GPS (with 5s timeout)
 * 2. Cached GPS position (up to 5 min old)
 * 3. IP-based geolocation (free API)
 */

export interface GeoLocationResult {
  latitude: number | null;
  longitude: number | null;
  location_available: boolean;
  city?: string;
  source?: 'browser_gps' | 'ip_geolocation' | 'fallback';
}

async function tryBrowserGPS(): Promise<GeoLocationResult | null> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos?.coords?.latitude && pos?.coords?.longitude) {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            location_available: true,
            source: 'browser_gps',
          });
        } else {
          resolve(null);
        }
      },
      () => resolve(null),
      {
        timeout: 5000,
        enableHighAccuracy: true,
        maximumAge: 300000, // Use cached GPS fix up to 5 min old
      },
    );
  });
}

async function tryIPGeolocation(): Promise<GeoLocationResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.success && data.latitude && data.longitude) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        location_available: true,
        city: data.city,
        source: 'ip_geolocation',
      };
    }
  } catch {
    // IP geolocation failed
  }
  return null;
}

export async function getAccurateLocation(): Promise<GeoLocationResult> {
  // Try browser GPS first
  const gpsResult = await tryBrowserGPS();
  if (gpsResult) return gpsResult;

  // Fallback to IP-based geolocation
  const ipResult = await tryIPGeolocation();
  if (ipResult) return ipResult;

  return {
    latitude: null,
    longitude: null,
    location_available: false,
    source: 'fallback',
  };
}
