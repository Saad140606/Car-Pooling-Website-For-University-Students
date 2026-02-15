# Analytics Refactoring - Quick Reference

**Last Updated**: February 15, 2026  
**Status**: ✅ Ready for Production

---

## What Changed?

| Component | Before | After | Why |
|-----------|--------|-------|-----|
| **Data Fetching** | Separate API calls in each component | Single unified fetch in context | Prevents data desync |
| **Loading State** | Single `isLoading` flag | Separate `isInitialLoading` & `isUpdating` | Prevents UI flicker |
| **Caching** | No caching | localStorage with smart loading | Instant page loads |
| **DriverEarningsCard** | Fetches own data | Uses context | Eliminates duplicate API call |
| **Performance Overview** | Shows PKR 0 | Shows correct earnings | Uses same data source |

---

## Key Files

```
NEW:
├─ src/lib/AnalyticsContext.tsx          ← Centralized state management
└─ src/app/dashboard/analytics/
   └─ AnalyticsPageWrapper.tsx            ← Provides context to page

MODIFIED:
├─ src/app/dashboard/analytics/page.tsx   ← Now uses wrapper
├─ src/app/dashboard/analytics/page-premium.tsx ← Uses useAnalytics()
└─ src/components/analytics/DriverEarningsCard.tsx ← Uses context
```

---

## How to Use

### 1. In Existing Pages

```typescript
import { useAnalytics } from '@/lib/AnalyticsContext';

export function YourComponent() {
  // This data comes from context (cached + updated)
  const { analytics, isUpdating, isCached } = useAnalytics();
  
  if (!analytics) return <div>No data</div>;
  
  return (
    <div>
      Total Earnings: {analytics.driverMetrics?.totalEarnings}
      {isCached && <span>From cache</span>}
      {isUpdating && <span>Updating...</span>}
    </div>
  );
}
```

### 2. In New Pages

```typescript
// 1. Wrap page with provider in wrapper file
// src/app/new-analytics-page/AnalyticsPageWrapper.tsx
export default function Wrapper() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
  
  return (
    <AnalyticsProvider firestore={firestore} user={user} userData={userData}>
      <YourPage />
    </AnalyticsProvider>
  );
}

// 2. Export wrapper from page.tsx
// src/app/new-analytics-page/page.tsx
export { default } from './AnalyticsPageWrapper';

// 3. Use hook in your page
// src/app/new-analytics-page/YourPage.tsx
const { analytics } = useAnalytics();
```

---

## State from Context

```typescript
interface AnalyticsContextType {
  // Data
  analytics: CombinedAnalytics | null;          // Full analytics object
  rideHistory: RideHistoryEntry[];              // All rides
  
  // Loading States
  isInitialLoading: boolean;                    // First load (show skeleton)
  isUpdating: boolean;                          // Background update (no UI block)
  error: string | null;                         // Error message if any
  
  // Metadata
  lastUpdated: Date | null;                     // When data was updated
  isCached: boolean;                            // Is current data from cache?
  
  // Actions
  refresh: () => Promise<void>;                 // Manual refresh
  reset: () => void;                            // Clear all state & cache
}
```

---

## Common Usage Patterns

### Pattern 1: Show Data with Cache Indicator

```typescript
const { analytics, isCached } = useAnalytics();

if (!analytics) return <LoadingState />;

return (
  <div>
    <h1>{analytics.driverMetrics?.totalEarnings}</h1>
    {isCached && <Badge>Showing saved data</Badge>}
  </div>
);
```

### Pattern 2: Handle Loading States

```typescript
const { analytics, isInitialLoading, isUpdating } = useAnalytics();

if (isInitialLoading) return <AnalyticsSkeleton />;  // Only once
if (!analytics) return <ErrorState />;

return (
  <div>
    {analytics && <Analytics data={analytics} />}
    {isUpdating && <UpdateIndicator />}  // Subtle, in background
  </div>
);
```

### Pattern 3: Manual Refresh

```typescript
const { refresh, isUpdating } = useAnalytics();

return (
  <Button onClick={refresh} disabled={isUpdating}>
    {isUpdating ? 'Updating...' : 'Refresh'}
  </Button>
);
```

### Pattern 4: Error Handling

```typescript
const { analytics, error, refresh } = useAnalytics();

if (error && !analytics) {
  return (
    <div>
      <p>Error: {error}</p>
      <Button onClick={refresh}>Try Again</Button>
    </div>
  );
}

// If we have cached data despite error:
return (
  <>
    {analytics && <Analytics data={analytics} />}
    {error && <AlertBanner message={error} />}
  </>
);
```

---

## Cache Behavior

### When Cache is Used
1. **Same user, same university** - Cache is valid
2. **Page load while connected** - Shows cache, fetches background
3. **Page load offline** - Shows cache, waits for connection
4. **User clicks refresh** - Fetches fresh, updates UI

### When Cache is Cleared
1. **University changes** - Cache invalidated
2. **Browser storage cleared** - Lost, will fetch fresh
3. **Metadata older than hour** - (Optional future feature)
4. **User calls reset()** - Explicitly cleared

---

## Debugging

### Print Cache Status

```typescript
const { analytics, isCached, isUpdating } = useAnalytics();

// In component:
useEffect(() => {
  console.log({
    hasCachedData: !!analytics,
    isCached,
    isUpdating,
    earnings: analytics?.driverMetrics?.totalEarnings,
  });
}, [analytics, isCached, isUpdating]);
```

### Check localStorage

```javascript
// In DevTools console:

// View all cache keys
Object.keys(localStorage).filter(k => k.includes('analytics'))

// View cached data
JSON.parse(localStorage.getItem('analytics_combined_cache'))

// View metadata
JSON.parse(localStorage.getItem('analytics_metadata_cache'))

// Clear cache
['analytics_combined_cache', 'analytics_history_cache', 'analytics_metadata_cache'].forEach(k => localStorage.removeItem(k))
```

### Monitor Network Requests

```
Chrome DevTools > Network tab

🟢 Initial load (with cache):
   - No "computeUserAnalytics" requests visible
   - Data rendered from cache

🔵 Initial load (no cache):
   - Single API request visible
   - Data fetched and rendered

🟠 Background update (after load):
   - API request in background
   - Doesn't block UI
```

---

## Troubleshooting

### Problem: Still Seeing Loading Spinner

**Check**: Is `isInitialLoading` being used to show skeleton?
```typescript
// ❌ Wrong
{isLoading && <AnalyticsSkeleton />}

// ✅ Right
{isInitialLoading && <AnalyticsSkeleton />}
```

### Problem: Cache Not Working

**Check**: Is localStorage enabled?
```javascript
// In console:
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  console.log('✅ localStorage working');
} catch (e) {
  console.error('❌ localStorage disabled or full');
}
```

**Check**: Is university matching?
```javascript
const metadata = JSON.parse(localStorage.getItem('analytics_metadata_cache'));
console.log('Cached university:', metadata?.university);
console.log('Current university:', currentUser?.university);
```

### Problem: Data Not Updating in Background

**Check**: Is `isUpdating` being used?
```typescript
// Should see "Updating..." when background fetch happens
{isUpdating && <span>Updating in background...</span>}
```

**Check**: Wait a few seconds and verify refresh actually called backend
- Open DevTools Network tab
- Look for API requests 2-3 seconds after page load

### Problem: Multiple Tabs Not Synced

**Expected Behavior**: Each tab has independent cache (this is OK)
**Solution**: User opens page in new tab → Shows its own cached version → Updates if different

### Problem: Analytics Data Shows Old Values

**Expected Behavior**: First time loads from cache (might be 10+ min old)
**Why**: Cache persists for hours until cleared
**Solution**: Click "Refresh" button to get latest data
**Better**: Background fetch runs automatically and updates smoothly

---

## Performance Expectations

### Typical Load Times

| Scenario | Time | What You See |
|----------|------|--------------|
| First load (no cache) | ~1.5-2.5s | Skeleton briefly, then analytics |
| Load with valid cache | ~100ms | Analytics instantly |
| Background refresh | ~1-2s | Happens silently, UI updates smoothly |
| Manual refresh | ~1-2s | Shows updating indicator |

### Network Requirements

- **Initial load**: ~50KB of data (computeUserAnalytics results)
- **Cache size**: ~15KB in localStorage
- **Bandwidth**: Low (~1 Mbps sufficient)
- **Offline**: Works without internet (cached data)

---

## API Endpoints Used

One unified endpoint:
```
POST /api/analytics/compute-user-analytics
├─ Input: firestore, userId, university
├─ Output: CombinedAnalytics object
└─ Called by: AnalyticsContext on mount (if no cache)
```

Note: Old `/api/analytics/driver` endpoint is no longer called (eliminated duplicate API)

---

## Migration Checklist

If adding this to new pages:

- [ ] Create wrapper component (AnalyticsPageWrapper.tsx)
- [ ] Wrap with `<AnalyticsProvider>`
- [ ] Replace page.tsx to export wrapper
- [ ] Replace local state with `useAnalytics()` hook
- [ ] Update loading UI to use `isInitialLoading` vs `isUpdating`
- [ ] Add cache/update indicators to UI
- [ ] Test: Page loads instantly (from cache)
- [ ] Test: Refresh works in background
- [ ] Test: Works offline with cached data
- [ ] Test: Data matches across all components

---

## Questions?

**Q: Why two loading states?**  
A: `isInitialLoading` decides if skeleton shows (first load only). `isUpdating` shows background refresh indicator (never blocks UI).

**Q: Does cache sync across tabs?**  
A: No, each tab has independent cache. This is acceptable - user clearly sees when data is cached.

**Q: Can I access analytics from any component?**  
A: Yes, if wrapped with AnalyticsProvider. Use `useAnalytics()` hook anywhere.

**Q: How long is cache valid?**  
A: Indefinitely until localStorage cleared or manual refresh. (Could add time-based expiry if needed.)

**Q: What if user switches universities?**  
A: Cache is keyed by university. Switching university loads that university's cache (or fetches if not cached).

---

**End of Quick Reference**
