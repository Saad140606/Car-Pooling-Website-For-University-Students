/**
 * Utility to construct a Google Maps Directions URL from ride route data.
 * Opens the route in a new tab with origin, destination, and optional waypoints.
 */

interface LatLng {
  lat: number;
  lng: number;
}

interface GoogleMapsRouteOptions {
  /** Full route array — first = origin, last = destination */
  route?: LatLng[] | null;
  /** Optional intermediate stops (used as waypoints) */
  stops?: LatLng[] | null;
  /** Fallback: origin location name (used when route coords are unavailable) */
  fromName?: string;
  /** Fallback: destination location name */
  toName?: string;
  /** Travel mode: driving (default), walking, bicycling, transit */
  travelMode?: 'driving' | 'walking' | 'bicycling' | 'transit';
}

/**
 * Build a Google Maps Directions URL from ride data.
 * Prefers lat/lng coordinates from route array; falls back to place names.
 * 
 * @returns URL string, or null if insufficient data
 */
export function buildGoogleMapsUrl(options: GoogleMapsRouteOptions): string | null {
  const { route, stops, fromName, toName, travelMode = 'driving' } = options;

  let origin = '';
  let destination = '';
  const waypointParts: string[] = [];

  // Extract origin/destination from route coordinates
  if (route && route.length >= 2) {
    const first = route[0];
    const last = route[route.length - 1];

    if (isValidCoord(first) && isValidCoord(last)) {
      origin = `${first.lat},${first.lng}`;
      destination = `${last.lat},${last.lng}`;
    }
  }

  // Fallback to place names if coordinates not available
  if (!origin && fromName) {
    origin = encodeURIComponent(fromName);
  }
  if (!destination && toName) {
    destination = encodeURIComponent(toName);
  }

  // Not enough data to build a URL
  if (!origin || !destination) return null;

  // Add stop waypoints
  if (stops && stops.length > 0) {
    for (const stop of stops) {
      if (isValidCoord(stop)) {
        waypointParts.push(`${stop.lat},${stop.lng}`);
      }
    }
  }

  // Build URL
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('origin', origin);
  params.set('destination', destination);
  params.set('travelmode', travelMode);

  if (waypointParts.length > 0) {
    params.set('waypoints', waypointParts.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Open Google Maps directions in a new tab.
 * Returns true if URL was opened, false if data was insufficient.
 */
export function openGoogleMapsRoute(options: GoogleMapsRouteOptions): boolean {
  const url = buildGoogleMapsUrl(options);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function isValidCoord(coord: LatLng | null | undefined): coord is LatLng {
  return (
    coord != null &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    isFinite(coord.lat) &&
    isFinite(coord.lng)
  );
}
