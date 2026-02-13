# Network Error Handling - Quick Start (30 seconds)

## The Problem We Solved

❌ **Before:** Network errors caused silent failures—blank screens, no error message
✅ **After:** Users see a clear error banner with recovery options

## What Users See Now

### Offline
```
🔌 Offline
Please connect to the internet.
```

### Network Error
```
⚠️ Connection error
Unable to connect. Please check your internet connection.
[Retry]
```

### Timeout
```
⏱️ Request timed out
The request took too long. Please try again.
[Retry]
```

## For App Users

**That's it!** The error handling is automatic. Just:
- ✅ Connect to internet → error disappears
- ✅ Click "Retry" → tries again immediately
- ✅ Wait → app automatically retries with delays

---

## For Developers

### 1. For Simple Data Fetches (< 1 minute)

**CURRENT CODE:**
```typescript
const [data, setData] = useState(null);

useEffect(() => {
  fetch('/api/rides')
    .then(r => r.json())
    .then(setData)
    .catch(err => console.error(err)); // Silent failure!
}, []);
```

**NEW CODE:**
```typescript
const { data } = useFetch('/api/rides', { showUserError: true });
```

**Done!** Error handling is automatic.

### 2. For Form Submissions (< 1 minute)

**CURRENT CODE:**
```typescript
const handleSubmit = async (data) => {
  try {
    await fetch('/api/rides', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    setError(error.message); // Shows raw error!
  }
};
```

**NEW CODE:**
```typescript
const { mutate } = useMutation();

const handleSubmit = async (data) => {
  await mutate('/api/rides', 'POST', data);
  // Error handling is automatic!
};
```

### 3. For Firestore Data (Already Done!)

**NO CHANGES NEEDED!**

useCollection and useDoc hooks already emit network errors automatically.

### 4. Manual Error Display

```typescript
import { emitNetworkError } from '@/components/NetworkErrorListener';

try {
  await doSomething();
} catch (error) {
  emitNetworkError(error); // Shows error banner to user
}
```

---

## API Reference - 30 Seconds Version

### useFetch Hook
```typescript
const { data, loading, error, retry } = useFetch(url, options);
```
- `data` - The fetched data
- `loading` - true while fetching
- `error` - Error object if failed
- `retry` - Function to retry manually

### useMutation Hook
```typescript
const { mutate, loading } = useMutation(options);
await mutate(url, method, body);
```
- `mutate` - Function to make request
- `loading` - true while loading
- `onSuccess` - Callback on success
- `onError` - Callback on error

### useOnlineStatus Hook
```typescript
const { isOnline, offlineDuration } = useOnlineStatus();
```
- `isOnline` - boolean, true if connected
- `offlineDuration` - milliseconds offline

### useRetry Hook
```typescript
const { retry, isRetrying, attempt } = useRetry(options);
await retry(function);
```
- `retry` - Execute function with retries
- `isRetrying` - Currently retrying?
- `attempt` - Current attempt number

### emitNetworkError Function
```typescript
emitNetworkError(error);
```
- Shows error banner to user
- Only for network/timeout errors

---

## Error Types (Reference)

| Type | Message | Retry? |
|------|---------|--------|
| `offline` | "You are offline" | Auto-dismiss on reconnect |
| `timeout` | "Request timed out" | ✅ Yes |
| `network_error` | "Connection error" | ✅ Yes |
| `server_error` | "Server error" | ✅ Yes |
| `not_found` | "Not found" | ❌ No |
| `permission_denied` | "Not authorized" | ❌ No |
| `validation_error` | "Invalid data" | ❌ No |
| `unknown` | "Unknown error" | ❌ No |

Retryable errors automatically show "Retry" button and retry with backoff.

---

## Testing Errors

### Simulate Offline
- Chrome DevTools > Network tab > Throttling > **Offline**
- Observe: Orange offline banner appears

### Simulate Timeout
- Chrome DevTools > Network tab > Throttling > **GPRS** (or custom 1-2 Mbps)
- Observe: Yellow timeout banner appears after ~30s
- Click Retry → auto-retries in 1s, 2s, 4s delays

### Simulate Network Error
- Chrome DevTools > Disable network adapter
- Observe: Red network error banner appears
- Reconnect → banner auto-dismisses

---

## File Locations

Full documentation:
- `docs/NETWORK_ERROR_HANDLING.md` - Complete guide (15 min read)
- `docs/NETWORK_ERROR_HANDLING_EXAMPLES.md` - Code examples

Implementation:
- `src/lib/networkErrorHandler.ts` - Error classification
- `src/lib/fetchWithTimeout.ts` - Fetch with timeout
- `src/hooks/useFetch.ts` - Data fetch hook
- `src/hooks/useRetry.ts` - Retry logic
- `src/hooks/useOnlineStatus.ts` - Online status detection
- `src/components/NetworkErrorListener.tsx` - Global error listener
- `src/components/NetworkErrorDisplay.tsx` - Error UI

---

## That's It!

**Next Steps:**
1. Read `NETWORK_ERROR_HANDLING_EXAMPLES.md` for your specific use case
2. Replace your `fetch()` calls with `useFetch()` or `useMutation()`
3. Test with network throttling
4. Keep an eye on the console for technical errors while users see clean messages

**Questions?** See full guide: `docs/NETWORK_ERROR_HANDLING.md`
