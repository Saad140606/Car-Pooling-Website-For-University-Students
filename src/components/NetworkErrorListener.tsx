'use client';

import { useEffect, useState } from 'react';
import { NetworkErrorDisplay, OfflineIndicator } from '@/components/NetworkErrorDisplay';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { classifyError, NetworkError } from '@/lib/networkErrorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

const NETWORK_ERROR_EVENT = 'network-error';

/**
 * Global network error emitter for triggering error displays
 * Call this when you want to show a network error to the user
 */
export function emitNetworkError(error: unknown) {
  const classified = classifyError(error);
  errorEmitter.emit(NETWORK_ERROR_EVENT, classified);
}

/**
 * Global network error listener and display component
 * Shows user-friendly error messages when network issues occur
 * Place this near the root of your app (in layout or provider)
 */
export function NetworkErrorListener() {
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [networkError, setNetworkError] = useState<NetworkError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Hydration safety: only render after mount to prevent SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for emitted network errors
  useEffect(() => {
    if (!mounted) return;

    const handleNetworkError = (error: NetworkError) => {
      console.warn('[NetworkErrorListener] Network error:', error);
      setNetworkError(error);

      // Also show a toast for quick notification
      if (!isOnline) {
        toast({
          variant: 'destructive',
          title: 'Offline',
          description: error.userMessage,
        });
      }
    };

    errorEmitter.on(NETWORK_ERROR_EVENT, handleNetworkError);

    return () => {
      errorEmitter.off(NETWORK_ERROR_EVENT, handleNetworkError);
    };
  }, [mounted, isOnline, toast]);

  // Clear error when user goes back online
  useEffect(() => {
    if (isOnline && networkError) {
      console.log('[NetworkErrorListener] User is back online, clearing error');
      setNetworkError(null);
    }
  }, [isOnline, networkError]);

  const handleRetry = async () => {
    if (!networkError?.retryable) return;

    setIsRetrying(true);
    try {
      // Simulate retry by clearing error after brief delay
      // The component using this error should implement actual retry logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNetworkError(null);
      toast({
        title: 'Retrying...',
        description: 'Attempting to reconnect.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    setNetworkError(null);
  };

  // Don't render anything until after hydration to prevent SSR mismatch
  if (!mounted) {
    return null;
  }

  // Show offline indicator if user is offline
  if (!isOnline) {
    return (
      <OfflineIndicator onRetry={handleRetry} />
    );
  }

  // Show network error if one occurred
  if (networkError) {
    return (
      <NetworkErrorDisplay
        error={networkError}
        onRetry={networkError.retryable ? handleRetry : undefined}
        onDismiss={handleDismiss}
        isRetrying={isRetrying}
        variant="banner"
      />
    );
  }

  return null;
}
