/**
 * Centralized timestamp parsing utility for handling Firestore Timestamps, Dates, and strings.
 * This is the SINGLE SOURCE OF TRUTH for all timestamp conversions in the application.
 * 
 * Firestore Timestamps can come in multiple formats:
 * 1. Firestore Timestamp object with .seconds and .nanoseconds
 * 2. Firestore Timestamp with .toDate() method
 * 3. Plain objects with .seconds/.nanoseconds from serialization
 * 4. Internal format with ._seconds/._nanoseconds
 * 5. JS Date objects
 * 6. Number (milliseconds or seconds)
 * 7. ISO date strings
 */

export interface ParsedTimestamp {
  date: Date;
  milliseconds: number;
  isValid: boolean;
}

/**
 * Parse any timestamp format into a Date object.
 * Returns null if parsing fails.
 * 
 * @param ts - Any timestamp value (Firestore Timestamp, Date, string, number, etc.)
 * @param options - { silent: true } to suppress console warnings
 * @returns Date object or null if parsing fails
 */
export function parseTimestamp(ts: any, options?: { silent?: boolean }): Date | null {
  const silent = options?.silent ?? false;

  if (!ts) {
    if (!silent) console.debug('[timestampUtils] Timestamp is null or undefined');
    return null;
  }

  try {
    // 1. If it's already a valid Date object, return it
    if (ts instanceof Date) {
      if (!isNaN(ts.getTime())) {
        return ts;
      }
      if (!silent) console.warn('[timestampUtils] Invalid Date object');
      return null;
    }

    // 2. If it's a number (milliseconds or seconds)
    if (typeof ts === 'number') {
      if (!isFinite(ts)) {
        if (!silent) console.warn('[timestampUtils] Number timestamp is not finite:', ts);
        return null;
      }
      // Firestore stores seconds since epoch, but JS uses milliseconds
      // If number > 10 billion, it's likely milliseconds
      // Otherwise treat as seconds and convert to milliseconds
      const ms = ts > 10_000_000_000 ? ts : ts * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return d;
      }
      if (!silent) console.warn('[timestampUtils] Invalid number conversion:', ts, '→', ms);
      return null;
    }

    // 3. If it's an object, try multiple strategies
    if (ts && typeof ts === 'object') {
      // Try .toDate() method (Firebase SDK Timestamp)
      if (typeof ts.toDate === 'function') {
        try {
          const d = ts.toDate();
          if (d instanceof Date && !isNaN(d.getTime())) {
            return d;
          }
        } catch (e) {
          if (!silent) console.warn('[timestampUtils] toDate() method failed:', e);
        }
      }

      // Try .seconds and .nanoseconds (Firestore Timestamp format)
      if (typeof ts.seconds === 'number') {
        const seconds = ts.seconds;
        const nanoseconds = ts.nanoseconds || 0;
        
        if (isFinite(seconds)) {
          const ms = seconds * 1000 + (nanoseconds / 1_000_000);
          if (isFinite(ms)) {
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
              return d;
            }
          }
        }
        if (!silent) console.warn('[timestampUtils] Invalid Firestore Timestamp:', { seconds, nanoseconds });
        return null;
      }

      // Try internal ._seconds and ._nanoseconds (internal format)
      if (typeof ts._seconds === 'number') {
        const seconds = ts._seconds;
        const nanoseconds = ts._nanoseconds || 0;
        
        if (isFinite(seconds)) {
          const ms = seconds * 1000 + (nanoseconds / 1_000_000);
          if (isFinite(ms)) {
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
              return d;
            }
          }
        }
        if (!silent) console.warn('[timestampUtils] Invalid internal Timestamp:', { _seconds: seconds, _nanoseconds: nanoseconds });
        return null;
      }

      // Try .toMillis() method (some Firestore implementations)
      if (typeof ts.toMillis === 'function') {
        try {
          const ms = ts.toMillis();
          if (typeof ms === 'number' && isFinite(ms)) {
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
              return d;
            }
          }
        } catch (e) {
          if (!silent) console.warn('[timestampUtils] toMillis() method failed:', e);
        }
      }

      // Try .getTime() method (Date-like objects)
      if (typeof ts.getTime === 'function') {
        try {
          const ms = ts.getTime();
          if (typeof ms === 'number' && isFinite(ms)) {
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
              return d;
            }
          }
        } catch (e) {
          if (!silent) console.warn('[timestampUtils] getTime() method failed:', e);
        }
      }
    }

    // 4. If it's a string, try parsing as ISO date or other date string
    if (typeof ts === 'string' && ts.length > 0) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d;
      }
      if (!silent) console.warn('[timestampUtils] Failed to parse string timestamp:', ts);
      return null;
    }

    if (!silent) console.warn('[timestampUtils] Could not parse timestamp of type', typeof ts, ':', ts);
    return null;
  } catch (e) {
    if (!silent) console.error('[timestampUtils] Unexpected error parsing timestamp:', e, ts);
    return null;
  }
}

/**
 * Parse any timestamp format into milliseconds since epoch.
 * Returns null if parsing fails.
 * 
 * @param ts - Any timestamp value
 * @param options - { silent: true } to suppress console warnings
 * @returns Number of milliseconds since epoch or null
 */
export function parseTimestampToMs(ts: any, options?: { silent?: boolean }): number | null {
  const date = parseTimestamp(ts, options);
  return date ? date.getTime() : null;
}

/**
 * Check if a ride is expired (departure time has passed).
 * 
 * @param departureTime - The departure timestamp in any format
 * @param options - { silent: true } to suppress console warnings
 * @returns true if the ride is expired, false otherwise (including if timestamp is invalid)
 */
export function isRideExpired(departureTime: any, options?: { silent?: boolean }): boolean {
  const ms = parseTimestampToMs(departureTime, options);
  
  // If we can't parse the timestamp, treat as NOT expired (defensive: keep visible)
  if (ms === null) {
    return false;
  }
  
  return ms <= Date.now();
}

/**
 * Format a timestamp for display in the UI.
 * Returns a fallback string if parsing fails.
 * 
 * @param ts - Any timestamp value
 * @param fallback - String to return if parsing fails (default: "Invalid Date")
 * @returns Formatted date string
 */
export function formatTimestamp(
  ts: any,
  options?: {
    fallback?: string;
    format?: 'short' | 'long' | 'time-only' | 'date-only';
    silent?: boolean;
  }
): string {
  const fallback = options?.fallback ?? '⚠ Invalid Date';
  const format = options?.format ?? 'short';
  const silent = options?.silent ?? false;

  const date = parseTimestamp(ts, { silent });
  
  if (!date) {
    if (!silent) console.error('[timestampUtils] Failed to parse timestamp for formatting:', ts);
    return fallback;
  }

  try {
    switch (format) {
      case 'long':
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      
      case 'short':
        return date.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      
      case 'time-only':
        return date.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      
      case 'date-only':
        return date.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      
      default:
        return date.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    }
  } catch (formatError) {
    if (!silent) console.error('[timestampUtils] Date formatting failed:', formatError);
    // Fallback to ISO string format
    try {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    } catch (isoError) {
      return fallback;
    }
  }
}

/**
 * Validate that a timestamp is valid and can be parsed.
 * 
 * @param ts - Any timestamp value
 * @returns true if the timestamp can be parsed, false otherwise
 */
export function isValidTimestamp(ts: any): boolean {
  return parseTimestamp(ts, { silent: true }) !== null;
}

/**
 * Get hours elapsed since a departure time.
 * Returns 0 if timestamp is invalid or in the future.
 * 
 * @param departureTime - The departure timestamp in any format
 * @returns Number of hours elapsed (0 if invalid or future)
 */
export function getHoursAfterDeparture(departureTime: any): number {
  const ms = parseTimestampToMs(departureTime, { silent: true });
  
  if (ms === null || ms > Date.now()) {
    return 0;
  }
  
  const elapsed = Date.now() - ms;
  return elapsed / (1000 * 60 * 60); // Convert ms to hours
}
