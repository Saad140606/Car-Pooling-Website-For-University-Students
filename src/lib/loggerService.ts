/**
 * Unified Logger Service
 * Provides consistent error logging and debugging across all systems
 * Logs are sent to console and optionally to a remote service
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  module: string;
  message: string;
  data?: any;
  stack?: string;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private remoteEndpoint: string | null = null;
  private batchSize = 10;
  private batchQueue: LogEntry[] = [];

  initialize(remoteEndpoint?: string): void {
    this.remoteEndpoint = remoteEndpoint || null;
    console.log('[Logger] Initialized', { remoteEndpoint: this.remoteEndpoint ? 'configured' : 'none' });
  }

  log(level: LogLevel, module: string, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      module,
      message,
      data,
      stack: data?.stack || (new Error()).stack
    };

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const consoleLevel = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
    const prefix = `[${module}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    
    if (level === 'error') {
      console.error(`${prefix} ${timestamp} ${message}`, data);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${timestamp} ${message}`, data);
    } else if (level === 'debug') {
      console.debug(`${prefix} ${timestamp} ${message}`, data);
    } else {
      console.log(`${prefix} ${timestamp} ${message}`, data);
    }

    // Queue for remote logging
    if (level === 'error' || level === 'warn') {
      this.batchQueue.push(entry);
      if (this.batchQueue.length >= this.batchSize) {
        this.flushLogs().catch(console.error);
      }
    }
  }

  debug(module: string, message: string, data?: any): void {
    this.log('debug', module, message, data);
  }

  info(module: string, message: string, data?: any): void {
    this.log('info', module, message, data);
  }

  warn(module: string, message: string, data?: any): void {
    this.log('warn', module, message, data);
  }

  error(module: string, message: string, data?: any | Error): void {
    const errorData = data instanceof Error 
      ? { 
          name: data.name, 
          message: data.message, 
          stack: data.stack,
          code: (data as any).code
        }
      : data;
    this.log('error', module, message, errorData);
  }

  private async flushLogs(): Promise<void> {
    if (!this.remoteEndpoint || this.batchQueue.length === 0) return;

    const toSend = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const response = await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: toSend,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        console.warn('[Logger] Remote logging failed:', response.status);
        // Re-queue logs if remote logging failed
        this.batchQueue.push(...toSend);
      }
    } catch (error) {
      console.warn('[Logger] Failed to send logs:', error);
      // Re-queue logs on network error
      this.batchQueue.push(...toSend);
    }
  }

  /**
   * Get all logs (for debugging/support)
   */
  getLogs(filter?: { level?: LogLevel; module?: string; since?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(l => l.level === filter.level);
    }
    if (filter?.module) {
      filtered = filtered.filter(l => l.module === filter.module);
    }
    if (filter?.since) {
      filtered = filtered.filter(l => l.timestamp >= filter.since);
    }

    return filtered;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.batchQueue = [];
  }

  /**
   * Export logs as JSON for debugging
   */
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      exported: new Date().toISOString(),
      total: this.logs.length
    }, null, 2);
  }
}

export const loggerService = new LoggerService();
