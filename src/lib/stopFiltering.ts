// Utility functions for filtering and naming stops

interface StopInfo {
  name: string;
  displayName: string;
}

/**
 * Extract meaningful stop name from Nominatim reverse geocoding response
 * Prioritizes major landmarks, roads, intersections over minor details
 */
export function extractMeaningfulStopName(displayName: string): string {
  if (!displayName) return 'Stop';
  
  const parts = displayName.split(',').map((p: string) => p.trim());
  
  // Keywords that indicate important locations
  const importantKeywords = [
    'university', 'college', 'school', 'hospital', 'mosque', 'mall', 'market',
    'metro', 'station', 'interchange', 'hub', 'plaza', 'center', 'terminal',
    'airport', 'bridge', 'park', 'road', 'street', 'avenue', 'boulevard',
    'campus', 'building', 'complex', 'intersection', 'crossing', 'corner'
  ];
  
  // Look through parts for important keywords
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    if (importantKeywords.some(keyword => lowerPart.includes(keyword))) {
      return part;
    }
  }
  
  // If no important keyword found, try to use a combination of first two parts
  // But avoid using just house numbers or very generic terms
  let result = parts[0];
  
  if (parts.length > 1) {
    // If first part is just a number (house number), include second part
    if (/^\d+[a-z]?$/.test(result.trim())) {
      result = `${parts[0]}, ${parts[1]}`;
    }
    // If first part is too short (< 3 chars), likely abbreviation, include second
    else if (result.length < 3 && parts[1].length > 2) {
      result = `${parts[0]}, ${parts[1]}`;
    }
  }
  
  return result || 'Stop';
}

/**
 * Determine if a stop is important enough to display
 * Filters out minor road intersections and shows only meaningful stops
 */
export function isImportantStop(
  stopName: string,
  stopIndex: number,
  totalStops: number,
  distanceFromStart: number,
  totalDistance: number
): boolean {
  // Always keep first and last stops
  if (stopIndex === 0 || stopIndex === totalStops - 1) {
    return true;
  }
  
  const lowerName = stopName.toLowerCase();
  
  // Important location keywords - stops with these are always shown
  const importantKeywords = [
    'university', 'college', 'school', 'hospital', 'mosque', 'mall', 'market',
    'metro', 'station', 'interchange', 'hub', 'plaza', 'center', 'terminal',
    'airport', 'bridge', 'park', 'crossing', 'intersection', 'corner'
  ];
  
  const hasImportantKeyword = importantKeywords.some(keyword => 
    lowerName.includes(keyword)
  );
  
  if (hasImportantKeyword) {
    return true;
  }
  
  // Keep stops that are roughly at quarter/half/three-quarter points
  const relativeDistance = distanceFromStart / totalDistance;
  const quarterPoints = [0.25, 0.5, 0.75];
  
  // Allow +/- 10% tolerance
  const isNearQuarterPoint = quarterPoints.some(point => 
    Math.abs(relativeDistance - point) < 0.1
  );
  
  if (isNearQuarterPoint) {
    return true;
  }
  
  return false;
}

/**
 * Filter stops to show only important ones
 * Keeps start and end points regardless of importance
 */
export function filterImportantStops(stops: any[]): any[] {
  if (stops.length <= 3) {
    return stops; // Keep all stops if there are only a few
  }
  
  // Find total distance
  const lastStop = stops[stops.length - 1];
  const totalDistance = lastStop.distanceFromStart || 1;
  
  return stops.filter((stop, idx) => {
    return isImportantStop(
      stop.name,
      idx,
      stops.length,
      stop.distanceFromStart || 0,
      totalDistance
    );
  });
}

/**
 * Group nearby stops and return a filtered list
 * Combines stops that are very close together (within minDistance)
 * AGGRESSIVE: Removes stops that are too close together
 */
export function deduplicateNearbyStops(
  stops: any[],
  minDistanceMeters: number = 300
): any[] {
  if (stops.length <= 2) return stops;
  
  const result = [stops[0]]; // Always keep first
  
  for (let i = 1; i < stops.length - 1; i++) {
    const currentStop = stops[i];
    const lastKeptStop = result[result.length - 1];
    const distanceDiff = (currentStop.distanceFromStart || 0) - (lastKeptStop.distanceFromStart || 0);
    
    // Keep stop if it's far enough from the last kept stop
    // Also log what's being removed for debugging
    if (Math.abs(distanceDiff) >= minDistanceMeters) {
      result.push(currentStop);
    } else {
      console.log(`[DEDUP-DISTANCE] Removing "${currentStop.name}" - only ${distanceDiff}m from last stop`);
    }
  }
  
  // Always keep last stop
  if (stops.length > 1 && result[result.length - 1] !== stops[stops.length - 1]) {
    result.push(stops[stops.length - 1]);
  }
  
  return result;
}

/**
 * Remove consecutive stops with the same or very similar names
 * Keeps the first occurrence and skips duplicates
 * AGGRESSIVE: Removes any stop with a name that appears similar to previous stops
 */
export function deduplicateByName(stops: any[]): any[] {
  if (stops.length <= 2) return stops;
  
  const result = [stops[0]]; // Always keep first
  const seenNames = new Set<string>([(stops[0].name || '').toLowerCase().trim()]);
  
  for (let i = 1; i < stops.length - 1; i++) {
    const currentStop = stops[i];
    const currentName = (currentStop.name || '').toLowerCase().trim();
    
    // Skip if we've already seen this exact name
    if (seenNames.has(currentName)) {
      console.log(`[DEDUP] Skipping duplicate: "${currentStop.name}"`);
      continue;
    }
    
    // Check if this name is very similar to any previously seen name
    let isSimilarToExisting = false;
    for (const seenName of seenNames) {
      if (currentName === seenName) {
        isSimilarToExisting = true;
        break;
      }
      // Check for substring matches (but require both to be > 5 chars to avoid false positives)
      if (currentName.length > 5 && seenName.length > 5) {
        if (currentName.includes(seenName) || seenName.includes(currentName)) {
          isSimilarToExisting = true;
          console.log(`[DEDUP] Skipping similar name: "${currentStop.name}" (similar to "${seenName}")`);
          break;
        }
      }
    }
    
    if (isSimilarToExisting) {
      continue;
    }
    
    result.push(currentStop);
    seenNames.add(currentName);
  }
  
  // Always keep last stop if it's different
  if (stops.length > 1) {
    const lastStop = stops[stops.length - 1];
    const lastStopName = (lastStop.name || '').toLowerCase().trim();
    
    if (!seenNames.has(lastStopName)) {
      result.push(lastStop);
    }
  }
  
  return result;
}
