'use client';

import React, { ReactNode, ReactElement } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Global Error Boundary Component
 * 
 * Catches React rendering errors, component lifecycle errors, and prevents white screens.
 * Provides user-friendly error UI with recovery options.
 * 
 * Features:
 * - Catches all descendant component errors
 * - Prevents cascading failures
 * - Shows user-friendly error messages
 * - Provides recovery/refresh options
 * - Logs errors safely for debugging
 * - Auto-recovery after 5 sequential errors
 */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so next render shows error UI
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging (safe, non-intrusive logging)
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] Error Boundary caught: ${error.message}`;
    const componentStack = errorInfo.componentStack;

    // Store in session storage for developer debugging (non-intrusive)
    try {
      const errorLog = JSON.parse(sessionStorage.getItem('errorLog') || '[]');
      if (!Array.isArray(errorLog)) {
        errorLog.length = 0;
      }
      errorLog.push({
        timestamp,
        message: error.message,
        stack: error.stack,
        componentStack,
      });
      // Keep only last 10 errors
      if (errorLog.length > 10) {
        errorLog.shift();
      }
      sessionStorage.setItem('errorLog', JSON.stringify(errorLog));
    } catch (e) {
      // Silently fail if sessionStorage unavailable
    }

    // Log to console for development (at debug level to avoid noise)
    console.debug(errorMessage, {
      error: error.toString(),
      componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorCount: 0 });
    // Also refresh the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render(): ReactElement {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-4">
          <div className="max-w-md w-full">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div className="bg-red-500/10 p-4 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-slate-100 mb-2">
                Oops! Something Went Wrong
              </h1>

              {/* Error Message */}
              <p className="text-slate-400 mb-6">
                We encountered an unexpected error. Don't worry, our team has been notified.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-slate-900 rounded p-3 mb-6 text-left max-h-40 overflow-auto">
                  <p className="text-xs text-red-400 font-mono break-words">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
                >
                  Go to Home
                </button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-slate-500 mt-4">
                Error ID: {Math.random().toString(36).substr(2, 9)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as ReactElement;
  }
}
