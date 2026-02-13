# Network Error Handling - Integration Examples

This document provides real-world code examples showing how to integrate the new error handling into your page components. No UI changes needed — just wrap your data fetching logic.

## Example 1: Simple Data Fetch with useFetch Hook

### Before (No Error Handling)
```typescript
// src/app/dashboard/rides/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const response = await fetch('/api/rides');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setRides(data);
      } catch (error) {
        console.error('Error:', error);
        // User sees nothing - silent failure!
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {rides.map(ride => (
        <RideCard key={ride.id} ride={ride} />
      ))}
    </div>
  );
}
```

### After (With Error Handling)
```typescript
// src/app/dashboard/rides/page.tsx
'use client';

import { useFetch } from '@/hooks/useFetch';

export default function RidesPage() {
  const { data: rides = [], loading, error } = useFetch(
    '/api/rides',
    {
      showUserError: true,  // Automatically shows error banner to user
      autoRetry: true,      // Automatically retries on timeout/network errors
    }
  );

  if (loading) return <div>Loading...</div>;
  
  // useFetch handles all error display automatically, so you don't need
  // to check for error here. The bannr appears at the top automatically.
  
  return (
    <div>
      {rides.map(ride => (
        <RideCard key={ride.id} ride={ride} />
      ))}
    </div>
  );
}
```

**Key Changes:**
- ✅ Replaced `useEffect` + `fetch` + `setState` with single `useFetch()` call
- ✅ Removed `try/catch` block (handled internally)
- ✅ No error display code needed (handled globally)
- ✅ Added `showUserError: true` to show user-friendly error message
- ✅ Added `autoRetry: true` for automatic retry on connection issues

---

## Example 2: Form Submission with Mutation Hook

### Before (No Error Handling)
```typescript
// Component for creating a new ride
export function CreateRideForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: RideFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create ride');
      }

      const result = await response.json();
      // Navigate to new ride or show success
      window.location.href = `/rides/${result.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError(message); // Shows raw error to user!
      console.error('Submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(getFormData());
    }}>
      {/* form fields */}
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>{loading ? 'Creating...' : 'Create Ride'}</button>
    </form>
  );
}
```

### After (With Error Handling)
```typescript
// Component for creating a new ride
import { useMutation } from '@/hooks/useFetch';
import { useRouter } from 'next/navigation';

export function CreateRideForm() {
  const router = useRouter();
  const { mutate, loading } = useMutation({
    onSuccess: (result) => {
      // Navigate to new ride after successful creation
      router.push(`/rides/${result.id}`);
    },
    onError: (error) => {
      // Error already shown to user via NetworkErrorListener
      console.error('[Debug] Ride creation failed:', error);
    },
  });

  const handleSubmit = async (formData: RideFormData) => {
    try {
      await mutate('/api/rides', 'POST', formData);
    } catch (error) {
      // Error handling already done in useMutation
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(getFormData());
    }}>
      {/* form fields - NO error display needed */}
      <button disabled={loading}>{loading ? 'Creating...' : 'Create Ride'}</button>
    </form>
  );
}
```

**Key Changes:**
- ✅ Replaced manual `fetch` + `setState` with `useMutation()` hook
- ✅ Removed manual error handling (useMutation handles it)
- ✅ Removed error display from JSX (shown globally instead)
- ✅ No raw error messages leaked to UI
- ✅ Network timeout automatically retried, validation errors not retried

---

## Example 3: Firestore Data with Existing useCollection Hook

### Before (No Network Error Handling)
```typescript
import { useCollection } from '@/firebase/firestore/use-collection';

export function UserRides() {
  const [rides, error, loading] = useCollection('rides', [
    where('driverId', '==', userId),
  ]);

  if (error) {
    // Error might be: "FirebaseError: Missing or insufficient permissions"
    // Or: "Network error: Failed to fetch from Firestore"
    // User can't tell which one!
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      {rides.map(ride => (
        <RideCard key={ride.id} ride={ride} />
      ))}
    </div>
  );
}
```

### After (With Network Error Handling)
```typescript
// NO CHANGES NEEDED!
// useCollection hook now automatically emits network errors
// via NetworkErrorListener, which shows the global error banner

import { useCollection } from '@/firebase/firestore/use-collection';

export function UserRides() {
  const [rides, error, loading] = useCollection('rides', [
    where('driverId', '==', userId),
  ]);

  // Permission errors still show here (403 - user doesn't have access)
  if (error?.code === 'permission-denied') {
    return <div>You don't have permission to view these rides</div>;
  }

  // Network errors are automatically shown in global banner
  // No need to display them here!

  return (
    <div>
      {rides.map(ride => (
        <RideCard key={ride.id} ride={ride} />
      ))}
    </div>
  );
}
```

**Key Changes:**
- ✅ NO CODE CHANGES NEEDED for Firestore hooks
- ✅ Network errors automatically shown in global error banner
- ✅ Permission errors still available in component for custom handling
- ✅ Cleaner error handling: only show permission issues, network handled globally

---

## Example 4: Manually Emit Network Error for Custom Logic

### Scenario: Custom API validation that needs error handling

```typescript
import { emitNetworkError } from '@/components/NetworkErrorListener';
import { classifyError } from '@/lib/networkErrorHandler';

export function validateUserEmail() {
  return async (email: string) => {
    try {
      const response = await fetch('/api/validate-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      return true;
    } catch (error) {
      // Classify the error
      const classified = classifyError(error);

      // Log full error for debugging
      console.error('[Debug] Email validation error:', classified.rawMessage);

      // Show user-friendly error (only for network issues)
      if (classified.retryable) {
        emitNetworkError(error);
        throw new Error(classified.userMessage);
      }

      // For non-network errors, throw original
      throw error;
    }
  };
}
```

**Pattern:**
1. `classifyError()` to understand error type
2. Log technical details for debugging
3. `emitNetworkError()` to show network-specific errors to user
4. Re-throw non-network errors for component to handle

---

## Example 5: Conditional Data Fetching Based on Online Status

### Show different UI based on connectivity

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useFetch } from '@/hooks/useFetch';

export function Dashboard() {
  const { isOnline } = useOnlineStatus();
  const { data: liveData, loading } = useFetch('/api/live-stats', {
    // Only fetch if online
    skip: !isOnline,
  });

  return (
    <div>
      {!isOnline && (
        <div>
          <p>Live statistics not available while offline</p>
          <p>Last sync: {/* show cached data */}</p>
        </div>
      )}

      {isOnline && loading && <div>Loading live data...</div>}

      {isOnline && liveData && (
        <StatsDisplay stats={liveData} />
      )}
    </div>
  );
}
```

---

## Example 6: Manual Retry for Complex Workflows

### Scenario: Upload file with progress and manual retry

```typescript
import { useRetry } from '@/hooks/useRetry';
import { useState } from 'react';

export function FileUpload({ file }: { file: File }) {
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { retry, isRetrying, attempt } = useRetry({
    maxAttempts: 3,
    initialDelayMs: 1000,
  });

  const handleUpload = async () => {
    setUploadError(null);

    try {
      const result = await retry(async () => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        // Track progress
        xhr.upload.addEventListener('progress', (e) => {
          const percent = (e.loaded / e.total) * 100;
          setProgress(percent);
        });

        return new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed'));
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));

          xhr.open('POST', '/api/upload');
          xhr.send(formData);
        });
      });

      console.log('Upload successful:', result);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Upload failed after 3 attempts'
      );
    }
  };

  return (
    <div>
      <button onClick={handleUpload} disabled={isRetrying}>
        {isRetrying ? `Retrying (Attempt ${attempt}/3)` : 'Upload'}
      </button>

      <div>Progress: {Math.round(progress)}%</div>

      {uploadError && <div className="error">{uploadError}</div>}
    </div>
  );
}
```

---

## Migration Checklist

Use this checklist when updating existing pages:

### For API Calls
- [ ] Replace `fetch()` calls with `useFetch()` or `useMutation()`
- [ ] Remove `try/catch` blocks (handled internally)
- [ ] Remove local error state management
- [ ] Remove manual error UI rendering
- [ ] Add `showUserError: true` to show errors to user
- [ ] Test with network throttling to verify error display

### For Firestore Queries
- [ ] Check if `useCollection` or `useDoc` is used
- [ ] No code changes needed!
- [ ] Remove any manual network error handling
- [ ] Keep permission error handling (403)
- [ ] Test with disabled network to verify error banner

### For Form Submissions
- [ ] Replace `fetch()` with `useMutation()`
- [ ] Remove error state variables
- [ ] Remove error display from JSX
- [ ] Keep `onSuccess` and `onError` callbacks for navigation/logging
- [ ] Test timeout retry by throttling network

### For Complex Workflows
- [ ] Use `useRetry()` for manual retry scenarios
- [ ] Use `useOnlineStatus()` to check connectivity
- [ ] Log technical errors with `[Debug]` prefix
- [ ] Show user-friendly messages via `emitNetworkError()`
- [ ] Test all error scenarios

---

## Common Patterns

### Pattern 1: Fetch with Fallback Data
```typescript
const { data = defaultData } = useFetch('/api/data');
// Uses defaultData if fetch fails, no error shown if not critical
```

### Pattern 2: Show Error Only for Specific Operations
```typescript
const { mutate } = useMutation();

try {
  await mutate('/api/critical', 'POST', data);
} catch (error) {
  // Error already shown to user
  alert('Please try again');
}
```

### Pattern 3: Retry Only on Specific Errors
```typescript
const { loading, error } = useFetch('/api/data');

if (error?.retryable) {
  // Show retry button
}
```

### Pattern 4: Combine Multiple Data Sources
```typescript
const { data: d1 } = useFetch('/api/data1');
const { data: d2 } = useFetch('/api/data2');
const [d3] = useCollection('docs');

// First error that occurs automatically shows error banner
```

---

## Questions?

Refer to:
- `NETWORK_ERROR_HANDLING.md` - Full API documentation
- `src/hooks/useFetch.ts` - Implementation details
- `src/lib/networkErrorHandler.ts` - Error classification logic
- `src/components/NetworkErrorListener.tsx` - Error listener implementation
