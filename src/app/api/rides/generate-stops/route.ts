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
  // Determine target stop count with enforced minimums
  const targetStopCount = getTargetStopCount(totalDistance);
  const stopSpacing = Math.max(1000, Math.floor(totalDistance / Math.max(1, targetStopCount)));
  const numStops = Math.max(targetStopCount, Math.ceil(totalDistance / stopSpacing));

  // Sample points along the route
  const sampleIndices = calculateSampleIndices(coordinates.length, numStops);
  const samplePoints = sampleIndices.map((idx) => {
    const coord = coordinates[idx];
    const distance = calculateDistanceAlongRoute(coordinates, idx);
    return { ...coord, distanceFromStart: distance };
  });

  // Fetch nearby places for each sample point
  const stops: any[] = [];
  const seenLocations = new Set<string>(); // Track duplicate coordinates
  const usedNames = new Map<string, number>(); // Track duplicate names and their counts
  const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent API calls
  const REQUEST_TIMEOUT_MS = 8000; // 8 second timeout per request

  // Process points in batches to avoid overwhelming the API
  for (let i = 0; i < samplePoints.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = samplePoints.slice(i, i + MAX_CONCURRENT_REQUESTS);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (point) => {
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
          );
          
          const fetchPromise = fetchNearbyPlaces(point.lat, point.lng, 300);
          const nearbyPlaces = await Promise.race([fetchPromise, timeoutPromise]) as any[];

          if (nearbyPlaces.length === 0) return null;

          // Filter for major locations
          const filtered = nearbyPlaces.filter((place: any) => getImportance(place.type) >= 0.6);

          const candidatePool = filtered.length > 0
            ? filtered
            : nearbyPlaces.filter((place: any) => getImportance(place.type) >= 0.4);

          if (candidatePool.length > 0) {
            const best = selectBestPlace(candidatePool);
            const locationKey = `${Math.round(best.lat * 1000)},${Math.round(best.lon * 1000)}`;

            // Skip if we've already added this location
            if (seenLocations.has(locationKey)) return null;

            seenLocations.add(locationKey);

            // Extract a unique, descriptive name
            const stopName = await getUniqueStopName(best, nearbyPlaces, usedNames, point.lat, point.lng);

            return {
              id: generateId(),
              name: stopName,
              lat: parseFloat(best.lat.toFixed(6)),
              lng: parseFloat(best.lon.toFixed(6)),
              distanceFromStart: point.distanceFromStart,
              type: best.type || 'landmark',
              placeId: best.place_id,
              isCustom: false,
              isAutoGenerated: true,
              order: stops.length,
            };
          }
          return null;
        } catch (error) {
          console.warn(`Failed to fetch nearby places for ${point.lat}, ${point.lng}:`, error);
          return null;
        }
      })
    );

    // Collect successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        stops.push(result.value);
        if (stops.length >= targetStopCount + 2) break;
      }
    }

    if (stops.length >= targetStopCount + 2) break;
  }

  return stops.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
}

/**
 * Determine optimal stop spacing based on route distance
 */
function getTargetStopCount(distanceMeters: number): number {
  if (distanceMeters < 5000) return 5; // minimum stops for short routes
  if (distanceMeters < 10000) return 6;
  if (distanceMeters < 20000) return 8;
  if (distanceMeters < 30000) return 10;
  if (distanceMeters < 50000) return 12;
  return 15; // larger routes
}

/**
 * Sample indices evenly distributed along the route
 */
function calculateSampleIndices(totalPoints: number, numSamples: number): number[] {
  const indices: number[] = [];
  const safeSamples = Math.max(1, Math.min(numSamples, Math.max(1, totalPoints - 2)));
  const step = Math.max(1, Math.floor(totalPoints / (safeSamples + 1)));

  for (let i = 1; i <= safeSamples; i++) {
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
 * With built-in timeout and error handling
 */
async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters: number = 300
): Promise<any[]> {
  const FETCH_TIMEOUT = 6000; // 6 second timeout
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    // Fetch multiple sources of place data for better disambiguation
    const [reverseData, nearbyData] = await Promise.all([
      // Main reverse geocode for the exact point
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&extratags=1`,
        {
          headers: { 'User-Agent': 'campus-ride-app' },
          signal: controller.signal,
        }
      ).then(r => r.ok ? r.json() : null).catch(() => null),
      
      // Search for nearby POIs within radius
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&lat=${lat}&lon=${lng}&radius=${radiusMeters}&limit=15&addressdetails=1&extratags=1`,
        {
          headers: { 'User-Agent': 'campus-ride-app' },
          signal: controller.signal,
        }
      ).then(r => r.ok ? r.json() : []).catch(() => [])
    ]).finally(() => clearTimeout(timeoutId));

    const results: any[] = [];

    // Add reverse geocoding result
    if (reverseData?.display_name) {
      results.push({
        ...reverseData,
        type: reverseData.type || reverseData.addresstype || reverseData.class || 'landmark',
        name: reverseData.name || reverseData.display_name.split(',')[0],
        lat: String(reverseData.lat ?? lat),
        lon: String(reverseData.lon ?? lng),
      });
    }

    // Add nearby POI results
    if (Array.isArray(nearbyData)) {
      for (const poi of nearbyData) {
        results.push({
          ...poi,
          type: poi.type || poi.addresstype || poi.class || 'landmark',
          name: poi.name || poi.display_name?.split(',')[0] || 'Location',
        });
      }
    }

    return results;
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
    // Very High importance - Major landmarks
    'landmark': 0.95,
    'university': 0.95,
    'college': 0.9,
    'hospital': 0.9,
    'shopping_centre': 0.9,
    'mall': 0.9,
    'stadium': 0.9,
    'airport': 0.95,
    
    // High importance - Key facilities
    'school': 0.85,
    'bus_stop': 0.85,
    'bus_station': 0.9,
    'metro_station': 0.9,
    'fuel': 0.8,
    'parking': 0.8,
    'bank': 0.75,
    'post_office': 0.75,
    'police': 0.8,
    'mosque': 0.85,
    'temple': 0.85,
    'church': 0.85,
    'government': 0.85,
    'hotel': 0.75,
    'market': 0.8,
    'supermarket': 0.75,
    
    // Medium importance - Common POIs
    'restaurant': 0.65,
    'cafe': 0.6,
    'fast_food': 0.55,
    'pharmacy': 0.7,
    'clinic': 0.75,
    'park': 0.7,
    'playground': 0.6,
    'library': 0.7,
    'cinema': 0.7,
    'theatre': 0.7,
    'shop': 0.5,
    
    // Roads and intersections
    'primary': 0.7,
    'secondary': 0.65,
    'tertiary': 0.6,
    'trunk': 0.75,
    'motorway': 0.8,
    'intersection': 0.55,
    
    // Low importance
    'residential': 0.2,
    'minor_intersection': 0.3,
    'house': 0.1,
    'office': 0.4,
    'building': 0.3,
  };

  return typeMap[osmType || ''] || 0.3;
}

/**
 * Select the best place from filtered results
 * Prioritizes specific named landmarks over generic roads
 */
function selectBestPlace(places: any[]): any {
  // First, try to find a named landmark (not just a road)
  const namedLandmarks = places.filter((p: any) => {
    const hasGoodName = p.name && 
                        p.name.length > 3 && 
                        !p.name.toLowerCase().includes('unnamed') &&
                        !p.name.match(/^(road|highway|expressway|street|lane)$/i);
    const isLandmarkType = ['university', 'hospital', 'school', 'mosque', 'temple', 
                            'shopping_centre', 'mall', 'market', 'stadium', 'park',
                            'hotel', 'bank', 'fuel'].includes(p.type);
    return hasGoodName || isLandmarkType;
  });

  if (namedLandmarks.length > 0) {
    // Sort by importance score
    return namedLandmarks.sort((a, b) => {
      const importanceA = getImportance(a.type);
      const importanceB = getImportance(b.type);
      return importanceB - importanceA;
    })[0];
  }

  // Fallback: sort all by importance
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

/**
 * Extract a unique, descriptive stop name
 * Returns nearby landmark or specific address details to avoid duplicates
 */
async function getUniqueStopName(
  primaryPlace: any,
  nearbyPlaces: any[],
  usedNames: Map<string, number>,
  lat: number,
  lng: number
): Promise<string> {
  // Extract the primary name (road/highway/landmark)
  let baseName = extractPrimaryName(primaryPlace);

  // Check if this name has been used before
  const currentCount = usedNames.get(baseName) || 0;

  if (currentCount === 0) {
    // First occurrence - use it as is
    usedNames.set(baseName, 1);
    return baseName;
  }

  // Name is a duplicate - find a nearby landmark to distinguish it
  const landmark = findNearbyLandmark(nearbyPlaces, baseName);
  
  if (landmark) {
    const uniqueName = `${baseName} (near ${landmark})`;
    usedNames.set(baseName, currentCount + 1);
    return uniqueName;
  }

  // Fallback: use address details for disambiguation
  const addressDetail = extractAddressDetail(primaryPlace);
  if (addressDetail && addressDetail !== baseName) {
    const uniqueName = `${baseName} (${addressDetail})`;
    usedNames.set(baseName, currentCount + 1);
    return uniqueName;
  }

  // Last resort: add sequential number
  const uniqueName = `${baseName} - Stop ${currentCount + 1}`;
  usedNames.set(baseName, currentCount + 1);
  return uniqueName;
}

/**
 * Extract the primary/main name from a place
 */
function extractPrimaryName(place: any): string {
  // Try to get the most specific name
  if (place.name && place.name.length > 3 && !place.name.toLowerCase().includes('unnamed')) {
    return place.name;
  }

  // Parse display_name for road/highway name
  if (place.display_name) {
    const parts = place.display_name.split(',').map((p: string) => p.trim());
    
    // First part is usually the most specific
    if (parts[0] && parts[0].length > 2) {
      return parts[0];
    }

    // Look for road/highway in parts
    for (const part of parts) {
      if (part.match(/road|highway|expressway|avenue|street|lane|circle/i)) {
        return part;
      }
    }

    // Return first meaningful part
    return parts[0] || 'Location';
  }

  // Check address fields
  const address = place.address || {};
  return address.road || 
         address.highway || 
         address.suburb || 
         address.neighbourhood || 
         address.city_district || 
         'Stop Location';
}

/**
 * Find a nearby landmark that's different from the base name
 */
function findNearbyLandmark(places: any[], baseName: string): string | null {
  // Priority order for landmark types
  const priorityTypes = [
    'university', 'college', 'school', 
    'hospital', 'clinic',
    'shopping_centre', 'mall', 'market',
    'mosque', 'temple', 'church',
    'park', 'stadium',
    'fuel', 'restaurant', 'hotel',
    'bank', 'post_office'
  ];

  for (const type of priorityTypes) {
    const landmark = places.find((p: any) => {
      if (p.type !== type) return false;
      const landmarkName = extractPrimaryName(p);
      return landmarkName && landmarkName !== baseName && landmarkName.length > 3;
    });

    if (landmark) {
      return extractPrimaryName(landmark);
    }
  }

  // Look for any named place that's not the base name
  for (const place of places) {
    const placeName = place.name || extractPrimaryName(place);
    if (placeName && 
        placeName !== baseName && 
        placeName.length > 3 && 
        !placeName.toLowerCase().includes('unnamed') &&
        getImportance(place.type) >= 0.5) {
      return placeName;
    }
  }

  return null;
}

/**
 * Extract additional address detail for disambiguation
 */
function extractAddressDetail(place: any): string | null {
  const address = place.address || {};

  // Try to find a meaningful detail
  const details = [
    address.suburb,
    address.neighbourhood,
    address.city_district,
    address.quarter,
    address.commercial,
    address.residential,
  ].filter(Boolean);

  // Return the first detail that's not too generic
  for (const detail of details) {
    if (detail && detail.length > 2 && !detail.match(/^(area|block|sector)$/i)) {
      return detail;
    }
  }

  return null;
}
