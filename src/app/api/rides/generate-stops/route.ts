/**
 * Generate Stops API
 * 
 * SECURITY: Requires authentication to prevent abuse of external geocoding services.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  applyRateLimit,
  errorResponse,
  successResponse,
} from '@/lib/api-security';

// Rate limit for stop generation (uses external APIs)
const STOP_GEN_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute
  keyPrefix: 'stop-gen',
};

/**
 * POST /api/rides/generate-stops
 * Generates major stops along a route using OpenStreetMap Nominatim API
 */
export async function POST(req: NextRequest) {
  // ===== AUTHENTICATION =====
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // ===== RATE LIMITING =====
  const rateLimitResult = await applyRateLimit(req, STOP_GEN_RATE_LIMIT);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    const body = await req.json();
    const { routePolyline, routeDistance, from, to } = body;

    // ===== INPUT VALIDATION =====
    if (!routePolyline || typeof routePolyline !== 'string') {
      return errorResponse('Missing or invalid routePolyline', 400);
    }

    if (!routeDistance || typeof routeDistance !== 'number' || routeDistance <= 0) {
      return errorResponse('Missing or invalid routeDistance', 400);
    }

    // Limit polyline length to prevent DoS
    if (routePolyline.length > 100000) {
      return errorResponse('Route polyline too long', 400);
    }

    // Decode polyline to get coordinates
    const coordinates = decodePolyline(routePolyline);
    
    if (coordinates.length < 2) {
      return errorResponse('Invalid route: too few coordinates', 400);
    }

    // Generate stops
    const stops = await generateStops(coordinates, routeDistance);

    return successResponse({
      success: true,
      stops,
      count: stops.length,
    });
  } catch (error: any) {
    console.error('Stop generation error:', error.code || 'UNKNOWN');
    return errorResponse('Failed to generate stops', 500);
  }
}

/**
 * Decode polyline string to array of coordinates
 * Supports Google's polyline encoding format
 */
function decodePolyline(polylineStr: string): Array<{ lat: number; lng: number; index: number }> {
  let index = 0, lat = 0, lng = 0;
  const coordinates: Array<{ lat: number; lng: number; index: number }> = [];

  while (index < polylineStr.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = polylineStr.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      byte = polylineStr.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
      index: coordinates.length,
    });
  }

  return coordinates;
}

/**
 * Main stop generation algorithm
 */
async function generateStops(
  coordinates: Array<{ lat: number; lng: number; index: number }>,
  totalDistance: number
): Promise<any[]> {
  // Determine optimal stop spacing
  const stopSpacing = getOptimalSpacing(totalDistance);
  const numStops = Math.ceil(totalDistance / stopSpacing);

  // Sample points along the route
  const sampleIndices = calculateSampleIndices(coordinates.length, numStops);
  const samplePoints = sampleIndices.map((idx) => {
    const coord = coordinates[idx];
    const distance = calculateDistanceAlongRoute(coordinates, idx);
    return { ...coord, distanceFromStart: distance };
  });

  // Fetch nearby places for each sample point
  const stops: any[] = [];
  const seenLocations = new Set<string>(); // Track duplicates

  for (const point of samplePoints) {
    try {
      const nearbyPlaces = await fetchNearbyPlaces(point.lat, point.lng, 300);

      if (nearbyPlaces.length === 0) continue;

      // Filter for major locations
      const filtered = nearbyPlaces.filter((place: any) => {
        const importance = getImportance(place.type);
        return importance >= 0.6;
      });

      if (filtered.length > 0) {
        const best = selectBestPlace(filtered);
        const locationKey = `${Math.round(best.lat * 1000)},${Math.round(best.lon * 1000)}`;

        // Skip if we've already added this location
        if (seenLocations.has(locationKey)) continue;

        seenLocations.add(locationKey);

        stops.push({
          id: generateId(),
          name: best.display_name || best.name || 'Stop',
          lat: parseFloat(best.lat.toFixed(6)),
          lng: parseFloat(best.lon.toFixed(6)),
          distanceFromStart: point.distanceFromStart,
          type: best.type || 'landmark',
          placeId: best.place_id,
          isCustom: false,
          isAutoGenerated: true,
          order: stops.length,
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch nearby places for ${point.lat}, ${point.lng}:`, error);
    }
  }

  return stops.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
}

/**
 * Determine optimal stop spacing based on route distance
 */
function getOptimalSpacing(distanceMeters: number): number {
  if (distanceMeters < 5000) return 5000; // 1 stop
  if (distanceMeters < 10000) return 4000; // 2-3 stops
  if (distanceMeters < 20000) return 5000; // 3-5 stops
  return 4000; // more stops
}

/**
 * Sample indices evenly distributed along the route
 */
function calculateSampleIndices(totalPoints: number, numSamples: number): number[] {
  const indices: number[] = [];
  const step = Math.floor(totalPoints / (numSamples + 1));

  for (let i = 1; i <= numSamples; i++) {
    const idx = Math.min(i * step, totalPoints - 1);
    indices.push(idx);
  }

  return indices;
}

/**
 * Calculate cumulative distance along the route using Haversine formula
 */
function calculateDistanceAlongRoute(
  coordinates: Array<{ lat: number; lng: number; index: number }>,
  upToIndex: number
): number {
  let distance = 0;

  for (let i = 1; i <= upToIndex; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    distance += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  return Math.round(distance);
}

/**
 * Haversine formula to calculate distance between two points (in meters)
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Fetch nearby places using OpenStreetMap Nominatim API
 */
async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters: number = 300
): Promise<any[]> {
  try {
    // Using Nominatim reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'campus-ride-app',
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();

    // Search for nearby POIs in the area
    const poiResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lng}&radius=${radiusMeters}&limit=10&extratags=1`,
      {
        headers: {
          'User-Agent': 'campus-ride-app',
        },
      }
    );

    if (!poiResponse.ok) return [];

    return await poiResponse.json();
  } catch (error) {
    console.error('Nominatim API error:', error);
    return [];
  }
}

/**
 * Get importance score for a place type
 */
function getImportance(osmType: string | undefined): number {
  const typeMap: Record<string, number> = {
    // High importance
    'landmark': 0.9,
    'university': 0.9,
    'hospital': 0.85,
    'bus_stop': 0.85,
    'parking': 0.8,
    'shopping_center': 0.85,
    'fuel': 0.75,
    'restaurant': 0.65,
    'cafe': 0.6,
    'bank': 0.7,
    'school': 0.75,
    'mosque': 0.8,
    'temple': 0.8,
    'church': 0.8,
    'government': 0.8,

    // Low importance
    'residential': 0.1,
    'minor_intersection': 0.3,
    'house': 0.05,
    'office': 0.4,
  };

  return typeMap[osmType || ''] || 0.3;
}

/**
 * Select the best place from filtered results
 */
function selectBestPlace(places: any[]): any {
  // Sort by importance and distance
  return places.sort((a, b) => {
    const importanceA = getImportance(a.type);
    const importanceB = getImportance(b.type);
    return importanceB - importanceA;
  })[0];
}

/**
 * Generate unique ID for stops
 */
function generateId(): string {
  return `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
