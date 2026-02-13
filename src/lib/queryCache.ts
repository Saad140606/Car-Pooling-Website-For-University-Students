/**
 * Simple in-memory query cache for reducing repeated Firestore fetches
 * Caches are invalidated after a TTL (default 5 minutes)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function setCacheEntry<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

export function getCacheEntry<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;

  // Check if cache entry has expired
  if (Date.now() - entry.timestamp > entry.ttl) {
    queryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
  } else {
    // Clear entries matching pattern (simple regex-like matching)
    for (const key of queryCache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
  }
}

export function getCacheKey(...parts: string[]): string {
  return parts.join('::');
}

/**
 * Hook-friendly version: returns cached data or fetcher function result
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  // Try cache first
  const cached = getCacheEntry<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch fresh data
  const data = await fetcher();
  setCacheEntry(key, data, ttl);
  return data;
}
