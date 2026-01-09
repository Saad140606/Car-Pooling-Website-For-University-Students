// Utilities for route handling: polyline encode/decode, bounds, and distance checks
export type LatLng = { lat: number; lng: number };
export type Waypoint = { name?: string; lat: number; lng: number };

// Decode a Google encoded polyline string into LatLng[]
export function decodePolyline(str: string): LatLng[] {
  let index = 0, lat = 0, lng = 0;
  const coordinates: LatLng[] = [];

  while (index < str.length) {
    let result = 1, shift = 0, b: number;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 1; shift = 0;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return coordinates;
}

// Encode lat/lng array into Google encoded polyline
export function encodePolyline(coords: LatLng[]): string {
  let prevLat = 0, prevLng = 0;
  let result = '';

  for (const { lat, lng } of coords) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);

    let dLat = latE5 - prevLat;
    let dLng = lngE5 - prevLng;

    prevLat = latE5;
    prevLng = lngE5;

    result += encodeSignedNumber(dLat);
    result += encodeSignedNumber(dLng);
  }
  return result;
}

function encodeSignedNumber(num: number) {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  return encodeNumber(sgnNum);
}

function encodeNumber(num: number) {
  let result = '';
  while (num >= 0x20) {
    result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  result += String.fromCharCode(num + 63);
  return result;
}

export function computeBounds(coords: LatLng[]) {
  if (!coords || coords.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

// Haversine distance (meters)
export function haversine(a: LatLng, b: LatLng) {
  const R = 6371000; // meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Distance from point to segment (in meters)
export function pointToSegmentDistance(p: LatLng, a: LatLng, b: LatLng) {
  // Convert to Cartesian on Earth's surface approximation using lat/lng degrees -> meters
  // Use simple projection based on haversine for small distances: project p onto segment ab in lat/lng space
  const toRad = (x: number) => (x * Math.PI) / 180;
  const latFactor = 111320; // approx meters per degree latitude

  // convert to local coordinates
  const ax = a.lng * Math.cos(toRad(a.lat)) * latFactor;
  const ay = a.lat * latFactor;
  const bx = b.lng * Math.cos(toRad(b.lat)) * latFactor;
  const by = b.lat * latFactor;
  const px = p.lng * Math.cos(toRad(p.lat)) * latFactor;
  const py = p.lat * latFactor;

  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const vLen2 = vx * vx + vy * vy;
  const t = vLen2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / vLen2));
  const projx = ax + t * vx;
  const projy = ay + t * vy;
  const dx = px - projx;
  const dy = py - projy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isPointNearPolyline(p: LatLng, polyline: LatLng[], thresholdMeters = 500) {
  if (!polyline || polyline.length === 0) return false;
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const d = pointToSegmentDistance(p, a, b);
    if (d < min) min = d;
    if (min <= thresholdMeters) return true;
  }
  return min <= thresholdMeters;
}
