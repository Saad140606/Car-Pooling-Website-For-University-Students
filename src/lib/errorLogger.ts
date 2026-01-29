'use client';

/**
 * Safe Error Logging Service
 * 
 * Non-intrusive error tracking and logging for debugging
 * Stores errors locally without exposing to users
 * Helps identify patterns and recurring issues
 */

export interface ErrorLogEntry {
  timestamp: string;
  level: 'debug' | 'warn' | 'error';
  component?: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 50;
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log an error for debugging
   */
  logError(
    message: string,
    error?: Error | unknown,
    context?: {
      component?: string;
      context?: Record<string, any>;
    }
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      component: context?.component,
      message,
      stack: error instanceof Error ? error.stack : undefined,
      context: context?.context,
    };

    this.addLog(entry);

    // Console output only in development
    if (this.isDevelopment) {
      console.error(`[${context?.component || 'App'}] ${message}`, error);
    } else {
      // Production: silent logging
      console.debug(`[ErrorLogger] ${message}`);
    }
  }

  /**
   * Log a warning
   */
  logWarn(
    message: string,
    context?: {
      component?: string;
      context?: Record<string, any>;
    }
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      component: context?.component,
      message,
      context: context?.context,
    };

    this.addLog(entry);

    if (this.isDevelopment) {
      console.warn(`[${context?.component || 'App'}] ${message}`);
    }
  }

  /**
   * Log debug info
   */
  logDebug(
    message: string,
    context?: {
      component?: string;
      context?: Record<string, any>;
    }
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      component: context?.component,
      message,
      context: context?.context,
    };

    this.addLog(entry);

    if (this.isDevelopment) {
      console.debug(`[${context?.component || 'App'}] ${message}`, context?.context);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: 'debug' | 'warn' | 'error'): ErrorLogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get logs filtered by component
   */
  getLogsByComponent(component: string): ErrorLogEntry[] {
    return this.logs.filter((log) => log.component === component);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Add log and maintain size limit
   */
  private addLog(entry: ErrorLogEntry) {
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist to session storage
    try {
      sessionStorage.setItem('__app_error_logs', JSON.stringify(this.logs));
    } catch (e) {
      // Session storage unavailable
    }
  }

  /**
   * Restore logs from session storage
   */
  private restoreLogs() {
    try {
      const stored = sessionStorage.getItem('__app_error_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      // Ignore restore errors
    }
  }

  /**
   * Get a summary of recent errors
   */
  getSummary(): {
    total: number;
    errors: number;
    warnings: number;
    debug: number;
    lastError?: ErrorLogEntry;
  } {
    return {
      total: this.logs.length,
      errors: this.logs.filter((l) => l.level === 'error').length,
      warnings: this.logs.filter((l) => l.level === 'warn').length,
      debug: this.logs.filter((l) => l.level === 'debug').length,
      lastError: this.logs
        .filter((l) => l.level === 'error')
        .slice(-1)[0],
    };
  }
}

// Global singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Hook for using error logger in components
 */
export function useErrorLogger(componentName: string) {
  return {
    error: (message: string, error?: unknown, context?: Record<string, any>) =>
      errorLogger.logError(message, error, { component: componentName, context }),
    warn: (message: string, context?: Record<string, any>) =>
      errorLogger.logWarn(message, { component: componentName, context }),
    debug: (message: string, context?: Record<string, any>) =>
      errorLogger.logDebug(message, { component: componentName, context }),
  };
}

/**
 * Make error logs accessible in console for debugging
 */
if (typeof window !== 'undefined') {
  (window as any).__getErrorLogs = () => errorLogger.getLogs();
  (window as any).__getErrorSummary = () => errorLogger.getSummary();
  (window as any).__exportErrorLogs = () => errorLogger.exportLogs();
  (window as any).__clearErrorLogs = () => errorLogger.clearLogs();
}
