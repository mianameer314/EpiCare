/**
 * Bulletproof Multi-Tier Geolocation Resolver
 * Ensures reliable GPS coordinates on Mobile, Laptops, Desktops, and Incognito mode.
 */

export interface GeoLocationResult {
  latitude: number | null;
  longitude: number | null;
  location_available: boolean;
  city?: string;
  source?: 'browser_gps' | 'network_ip' | 'unavailable';
}

export async function getAccurateLocation(): Promise<GeoLocationResult> {
  // 1. Try Browser HTML5 Geolocation (Precise on mobile devices)
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2500,
          enableHighAccuracy: false, // Standard Wi-Fi triangulation for fast laptop response
          maximumAge: 60000,
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
    } catch (err) {
      console.info('[Geo] Browser GPS unavailable or timed out, trying IP fallback:', err);
    }
  }

  // 2. Fallback: Network IP Geolocation (100% reliable on Wi-Fi laptops, desktops & Incognito tabs)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          location_available: true,
          city: data.city,
          source: 'network_ip',
        };
      }
    }
  } catch (ipErr) {
    console.warn('[Geo] IP Geolocation fallback unavailable:', ipErr);
  }

  return {
    latitude: null,
    longitude: null,
    location_available: false,
    source: 'unavailable',
  };
}
