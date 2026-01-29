'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Empty State Component - when no data is found
 */
export function EmptyState({
  title = 'No Data Found',
  description = 'There\'s nothing here yet.',
  icon: Icon = AlertCircle,
  action,
  className = '',
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="bg-slate-800/50 p-4 rounded-full mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Loading State Component - Skeleton loaders
 */
export function LoadingState({
  count = 3,
  height = 'h-20',
  className = '',
}: {
  count?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg animate-pulse`}
        />
      ))}
    </div>
  );
}

/**
 * Error State Component - when something goes wrong
 */
export function ErrorState({
  title = 'Something Went Wrong',
  description = 'An error occurred while loading this data.',
  error,
  onRetry,
  onGoHome,
  className = '',
}: {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
}) {
  const errorMessage = typeof error === 'string' ? error : error?.message;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="bg-red-500/10 p-4 rounded-full mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm">{description}</p>

      {errorMessage && process.env.NODE_ENV === 'development' && (
        <div className="bg-slate-900 rounded p-3 mb-6 max-w-sm w-full">
          <p className="text-xs text-red-400 font-mono break-words">{errorMessage}</p>
        </div>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        )}
      </div>
    </div>
  );
}
