'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Dashboard Error Page
 * Handles all errors that occur in dashboard routes
 * Provides recovery options and user-friendly messaging
 */
export default function DashboardErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = React.useState(false);

  const isAuthError = error?.message?.includes('auth') || error?.message?.includes('permission');
  const isNotFoundError = error?.message?.includes('not found') || error?.message?.includes('404');

  let title = 'Something Went Wrong';
  let description = 'An unexpected error occurred. Our team has been notified.';
  let primaryAction = 'Try Again';
  let primaryActionFn = reset;

  if (isAuthError) {
    title = 'Authentication Required';
    description = 'Your session may have expired. Please log in again.';
    primaryAction = 'Log In';
    primaryActionFn = () => router.push('/auth/ned/login');
  } else if (isNotFoundError) {
    title = 'Page Not Found';
    description = 'The page you\'re looking for doesn\'t exist or has been removed.';
    primaryAction = 'Go to Dashboard';
    primaryActionFn = () => router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-500/10 p-4 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Title and Description */}
          <h1 className="text-2xl font-bold text-slate-100 mb-2">{title}</h1>
          <p className="text-slate-400 text-sm mb-6">{description}</p>

          {/* Error Details (Dev Only) */}
          {process.env.NODE_ENV === 'development' && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-slate-500 hover:text-slate-400 mb-4 underline"
              >
                {showDetails ? 'Hide' : 'Show'} error details
              </button>
              {showDetails && (
                <div className="bg-slate-900 rounded p-3 mb-6 text-left max-h-40 overflow-auto">
                  <p className="text-xs text-red-400 font-mono break-words">
                    {error?.message}
                  </p>
                  {error?.digest && (
                    <p className="text-xs text-slate-500 font-mono mt-2">
                      ID: {error.digest}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={primaryActionFn}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {primaryAction}
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
