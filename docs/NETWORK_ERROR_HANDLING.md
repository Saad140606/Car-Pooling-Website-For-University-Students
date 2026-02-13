# Network Error Handling Implementation Guide

This document explains how network errors are now handled in the Campus Ride app and how to use the error handling utilities.

## Overview

The app now has a comprehensive network error handling system that:
- Detects and classifies different types of errors (network, timeout, offline, server errors)
- Shows user-friendly, non-technical messages
- Automatically retries failed requests
- Detects offline/online status changes
- Provides recovery options for users

## User-Facing Features

### 1. Offline Indicator
When the user loses internet connection, a banner appears at the top of the page:
```
[WiFi icon] You are offline
Please connect to the internet.
```

### 2. Network Error Banner
When a request fails due to network issues, a clear error message appears:
```
[Alert icon] Connection error
Unable to connect. Please check your internet connection.
[Retry button] [Dismiss button]
```

### 3. Automatic Retry
- Failed requests automatically retry with exponential backoff (1s, 2s, 4s, etc.)
- Users can manually click "Retry" button to retry immediately
- Toast notifications inform users of retry attempts

### 4. Error Classification
The app intelligently classifies errors:
- **Offline**: Device is not connected to internet
- **Timeout**: Request took too long (> 30 seconds by default)
- **Network Error**: Connection failed or unreachable
- **Server Error**: 500+ status codes
- **Not Found**: 404 errors
- **Permission Denied**: 403 errors
- **Validation Error**: Invalid data
- **Unknown**: Other errors

Each error type gets an appropriate message and retry behavior.

## For Developers: Using the Error Handling System

### 1. Basic Fetch with Error Handling

Use `useFetch` hook for GET requests:

```typescript
import { useFetch } from '@/hooks/useFetch';

export function MyComponent() {
  const { data, loading, error, retry } = useFetch(
    '/api/rides',
    {
      timeoutMs: 30000,           // 30 second timeout
      showUserError: true,         // Show error to user
      autoRetry: true,             // Automatically retry failed requests
    }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{JSON.stringify(data)}</div>;
}
```

### 2. POST/PUT/DELETE with Error Handling

Use `useMutation` hook for data mutations:

```typescript
import { useMutation } from '@/hooks/useFetch';

export function CreateRide() {
  const { data, loading, error, mutate } = useMutation({
    onSuccess: () => console.log('Ride created!'),
    onError: (err) => console.error('Failed to create ride:', err),
  });

  const handleSubmit = async (rideData) => {
    try {
      const result = await mutate('/api/rides', 'POST', rideData);
      console.log('Created:', result);
    } catch (err) {
      // Error already shown to user via NetworkErrorListener
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### 3. Manual Network Error Emission

If you want to manually show a network error:

```typescript
import { emitNetworkError } from '@/components/NetworkErrorListener';
import { ErrorType } from '@/lib/networkErrorHandler';

// In your component or API handler:
try {
  const data = await fetchData();
} catch (error) {
  emitNetworkError(error);
  // Error banner automatically appears
}
```

### 4. Using Fetch Utilities

For low-level fetch calls with timeout and retry:

```typescript
import { fetchWithTimeout, fetchWithRetry } from '@/lib/fetchWithTimeout';

// Simple fetch with timeout
try {
  const response = await fetchWithTimeout('/api/data', {
    timeoutMs: 10000, // 10 seconds
  });
  const data = await response.json();
} catch (error) {
  // Timeout or network error
}

// Fetch with automatic retries
try {
  const response = await fetchWithRetry('/api/data', {
    timeoutMs: 10000,
    retries: 3, // Try 3 times
  });
  const data = await response.json();
} catch (error) {
  // All retries failed
}
```

### 5. Offline Status Detection

Use the online status hook:

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function ConnectivityAwareness() {
  const { isOnline, offlineDuration } = useOnlineStatus();

  return (
    <div>
      {isOnline ? (
        <div>Online</div>
      ) : (
        <div>
          Offline for {Math.round(offlineDuration / 1000)} seconds
        </div>
      )}
    </div>
  );
}
```

### 6. Manual Retry Logic

For complex retry scenarios:

```typescript
import { useRetry } from '@/hooks/useRetry';

export function DataLoader() {
  const {
    retry,
    cancel,
    isRetrying,
    attempt,
    nextRetryTime,
  } = useRetry({
    maxAttempts: 5,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    onRetry: (attempt, delay) => {
      console.log(`Retry attempt ${attempt} in ${delay}ms`);
    },
  });

  const loadData = async () => {
    try {
      const result = await retry(async () => {
        const response = await fetch('/api/data');
        return response.json();
      });
      console.log('Data:', result);
    } catch (error) {
      console.error('Failed after retries:', error);
    }
  };

  return (
    <div>
      <button onClick={loadData}>Load</button>
      {isRetrying && (
        <p>Retrying... (attempt {attempt})</p>
      )}
    </div>
  );
}
```

### 7. Error Classification

Manually classify errors:

```typescript
import {
  classifyError,
  isNetworkError,
  isRetryable,
  ErrorType,
  NetworkError,
} from '@/lib/networkErrorHandler';

// Classify an error
const classified: NetworkError = classifyError(error);

// Check error type
if (classified.type === ErrorType.OFFLINE) {
  console.log('User is offline');
}

// Check if retryable
if (classified.retryable) {
  console.log('This error can be retried');
}

// Check if it's a network error
if (isNetworkError(error)) {
  console.log('Network-related error');
}
```

## Key Files

### Core Utilities
- `src/lib/networkErrorHandler.ts` - Error classification logic
- `src/lib/fetchWithTimeout.ts` - Fetch with timeout/retry support
- `src/components/NetworkErrorListener.tsx` - Global error listener and display
- `src/components/NetworkErrorDisplay.tsx` - Error UI component

### Hooks
- `src/hooks/useOnlineStatus.ts` - Detect online/offline status
- `src/hooks/useRetry.ts` - Retry logic with exponential backoff
- `src/hooks/useFetch.ts` - High-level fetch hook with error handling

### Integrations
- `src/firebase/firestore/use-collection.tsx` - Enhanced with network error emission
- `src/firebase/firestore/use-doc.tsx` - Enhanced with network error emission
- `src/firebase/provider.tsx` - Includes NetworkErrorListener globally

## Best Practices

### ✅ DO:

1. **Always use the fetch hooks for API calls**
   ```typescript
   const { data, loading, error } = useFetch('/api/rides');
   ```

2. **Show user-friendly messages**
   ```typescript
   // Good:
   "Unable to connect. Please check your internet."
   
   // Bad:
   "ENOTFOUND: getaddrinfo ENOTFOUND api.example.com"
   ```

3. **Assume network errors are retryable**
   ```typescript
   if (error.retryable) {
     showRetryButton();
   }
   ```

4. **Log technical details only to console**
   ```typescript
   console.error('[Technical Debug]', error); // OK
   toast({ description: error.message }); // NOT OK
   ```

5. **Handle offline state gracefully**
   ```typescript
   if (!isOnline) {
     return <OfflineScreen />;
   }
   ```

### ❌ DON'T:

1. **Don't use bare fetch() without timeout**
   ```typescript
   // BAD - can hang forever
   const data = await fetch('/api/data').then(r => r.json());
   
   // GOOD - has 30s timeout
   const data = await fetchWithTimeout('/api/data');
   ```

2. **Don't show raw error messages to users**
   ```typescript
   // BAD
   toast({ description: error.stack });
   
   // GOOD
   const classified = classifyError(error);
   toast({ description: classified.userMessage });
   ```

3. **Don't retry non-retryable errors**
   ```typescript
   // BAD - always retry
   await retry(async () => fetch('/api/data'));
   
   // GOOD - check if retryable first
   if (isRetryable(error)) {
     await retry(async () => fetch('/api/data'));
   }
   ```

4. **Don't ignore network errors**
   ```typescript
   // BAD - error silently ignored
   try {
     await fetch('/api/data');
   } catch (e) {
     // do nothing
   }
   
   // GOOD - error handled and shown to user
   try {
     await fetch('/api/data');
   } catch (e) {
     emitNetworkError(e);
   }
   ```

## Testing Network Error Scenarios

### Simulate Offline State
```typescript
// Chrome DevTools > Network > Throttling > Offline
// Or use:
window.dispatchEvent(new Event('offline'));
window.dispatchEvent(new Event('online'));
```

### Simulate Timeout
```typescript
// Chrome DevTools > Network > Throttling > GPRS (very slow)
// This will trigger timeout errors on your normal requests
```

### Simulate Connection Loss
```typescript
// Unplug network, or use:
navigator.onLine = false; // This won't actually work, but shows intent
```

### Test Retry Logic
```typescript
// Chrome DevTools > Network > Add custom throttling
// - Download: 10 kbps
// - Upload: 5 kbps
// - Latency: 2000 ms
```

## Troubleshooting

### Issue: Error not showing to user
**Solution**: Ensure `NetworkErrorListener` is in your layout:
```tsx
// In app/layout.tsx
<FirebaseProvider>
  <NetworkErrorListener /> {/* Must be here */}
  {children}
</FirebaseProvider>
```

### Issue: Infinite retry loop
**Solution**: Check that non-retryable errors are not being retried:
```typescript
if (error.retryable) {
  await retry(fn);
}
```

### Issue: Timeout not working
**Solution**: Make sure you're using `fetchWithTimeout`:
```typescript
// BAD - timeout ignored
await fetch(url);

// GOOD - timeout works
await fetchWithTimeout(url, { timeoutMs: 30000 });
```

### Issue: Offline indicator not showing
**Solution**: Check browser online/offline events:
```typescript
// In DevTools console:
window.navigator.onLine; // Should be true/false
window.dispatchEvent(new Event('offline')); // Test offline event
```

## Performance Notes

- Network error detection is lightweight (< 1ms)
- Retry logic uses exponential backoff to avoid overwhelming server
- Error classification doesn't block UI rendering
- Online/offline detection uses native browser APIs

## Changelog

### Version 1.0
- ✅ Network error detection and classification
- ✅ Offline/online detection
- ✅ Automatic retry with exponential backoff
- ✅ User-friendly error messages
- ✅ Global network error listener
- ✅ Fetch utilities with timeout support
