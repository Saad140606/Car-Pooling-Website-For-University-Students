'use client';

import React from 'react';
import { AlertTriangle, Wifi, WifiOff, Clock, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorType, NetworkError } from '@/lib/networkErrorHandler';

interface NetworkErrorDisplayProps {
  error: NetworkError | null;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  isRetrying?: boolean;
  showDismiss?: boolean;
  variant?: 'banner' | 'card' | 'modal';
}

/**
 * User-friendly error display component
 * Shows clear, actionable messages for network issues
 */
export function NetworkErrorDisplay({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  showDismiss = true,
  variant = 'banner',
}: NetworkErrorDisplayProps) {
  if (!error) return null;

  // Choose icon based on error type
  const getIcon = () => {
    switch (error.type) {
      case ErrorType.OFFLINE:
        return <WifiOff className="h-5 w-5" />;
      case ErrorType.TIMEOUT:
        return <Clock className="h-5 w-5" />;
      case ErrorType.NETWORK_ERROR:
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  // Choose colors based on error type
  const getColors = () => {
    switch (error.type) {
      case ErrorType.OFFLINE:
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/30',
          border: 'border-orange-200 dark:border-orange-800',
          icon: 'text-orange-600 dark:text-orange-400',
          text: 'text-orange-900 dark:text-orange-100',
          subtext: 'text-orange-700 dark:text-orange-200',
        };
      case ErrorType.TIMEOUT:
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/30',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          text: 'text-yellow-900 dark:text-yellow-100',
          subtext: 'text-yellow-700 dark:text-yellow-200',
        };
      case ErrorType.NETWORK_ERROR:
        return {
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          text: 'text-red-900 dark:text-red-100',
          subtext: 'text-red-700 dark:text-red-200',
        };
      default:
        return {
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          text: 'text-red-900 dark:text-red-100',
          subtext: 'text-red-700 dark:text-red-200',
        };
    }
  };

  const colors = getColors();

  if (variant === 'banner') {
    return (
      <div
        className={`w-full ${colors.bg} border-b ${colors.border} px-4 py-3 sm:px-6`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 max-w-7xl mx-auto">
          <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${colors.text}`}>
              {error.type === ErrorType.OFFLINE ? 'You are offline' : 'Connection error'}
            </p>
            <p className={`text-sm mt-1 ${colors.subtext}`}>
              {error.userMessage}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {error.retryable && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={isRetrying}
                className={`${colors.icon} hover:${colors.text}`}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {isRetrying ? 'Retrying...' : 'Try again'}
              </Button>
            )}
            {showDismiss && onDismiss && (
              <button
                onClick={onDismiss}
                className={`p-1 hover:opacity-70 transition-opacity ${colors.icon}`}
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`w-full ${colors.bg} border ${colors.border} rounded-lg p-4 sm:p-6`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
            {getIcon()}
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${colors.text}`}>
              {error.type === ErrorType.OFFLINE ? 'Connection lost' : 'Cannot load data'}
            </h3>
            <p className={`text-sm mt-2 ${colors.subtext}`}>
              {error.userMessage}
            </p>
            <div className="flex gap-3 mt-4">
              {error.retryable && onRetry && (
                <Button
                  size="sm"
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="bg-primary hover:bg-primary/90"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {isRetrying ? 'Retrying...' : 'Try again'}
                </Button>
              )}
              {showDismiss && onDismiss && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No modal variant in this basic implementation
  return null;
}

/**
 * Offline indicator banner (minimal version)
 * Shows only when user is completely offline
 */
export function OfflineIndicator({ onRetry }: { onRetry?: () => void }) {
  const offlineError: NetworkError = {
    type: ErrorType.OFFLINE,
    message: 'Device is offline',
    userMessage: 'You are offline. Please connect to the internet.',
    originalError: null,
    retryable: true,
  };

  return (
    <NetworkErrorDisplay
      error={offlineError}
      onRetry={onRetry}
      onDismiss={undefined}
      showDismiss={false}
      variant="banner"
    />
  );
}
