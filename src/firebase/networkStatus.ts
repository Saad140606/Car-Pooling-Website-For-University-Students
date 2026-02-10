/**
 * Network status monitor for Firestore connectivity
 * Helps diagnose and handle connection timeout issues
 */

export interface NetworkStatus {
  isOnline: boolean;
  hasConnectionTimeout: boolean;
  lastChecked: Date;
  connectionType?: string;
}

class NetworkStatusMonitor {
  private isOnline: boolean = true;
  private hasConnectionTimeout: boolean = false;
  private lastChecked: Date = new Date();
  private listeners: ((status: NetworkStatus) => void)[] = [];
  private checkTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initial check
    this.isOnline = navigator.onLine ?? true;
    this.logStatus();
  }

  private handleOnline() {
    console.log('[NetworkStatus] Device is online');
    this.isOnline = true;
    this.hasConnectionTimeout = false;
    this.lastChecked = new Date();
    this.notifyListeners();
  }

  private handleOffline() {
    console.log('[NetworkStatus] Device is offline');
    this.isOnline = false;
    this.lastChecked = new Date();
    this.notifyListeners();
  }

  /**
   * Check if network is reachable by attempting a simple fetch
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      // Use a lightweight endpoint to check connectivity
      const response = await Promise.race([
        fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connectivity check timeout')), 5000)
        ),
      ]);

      this.isOnline = true;
      this.hasConnectionTimeout = false;
      this.lastChecked = new Date();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.warn('[NetworkStatus] Connectivity check failed:', error);
      this.isOnline = false;
      this.hasConnectionTimeout = true;
      this.lastChecked = new Date();
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    const connectionType = (navigator as any).connection?.effectiveType || 'unknown';
    
    return {
      isOnline: this.isOnline,
      hasConnectionTimeout: this.hasConnectionTimeout,
      lastChecked: this.lastChecked,
      connectionType,
    };
  }

  /**
   * Subscribe to network status changes
   */
  subscribe(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[NetworkStatus] Listener error:', error);
      }
    });
  }

  private logStatus() {
    const status = this.getStatus();
    console.log('[NetworkStatus] Current status:', {
      isOnline: status.isOnline,
      hasConnectionTimeout: status.hasConnectionTimeout,
      connectionType: status.connectionType,
    });
  }
}

// Export singleton instance
export const networkStatusMonitor = new NetworkStatusMonitor();

/**
 * Hook to monitor network status (for React components)
 */
export function useNetworkStatus(): NetworkStatus {
  if (typeof window === 'undefined') {
    return {
      isOnline: true,
      hasConnectionTimeout: false,
      lastChecked: new Date(),
    };
  }

  const [status, setStatus] = React.useState(() => networkStatusMonitor.getStatus());

  React.useEffect(() => {
    const unsubscribe = networkStatusMonitor.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

// React import for hook
import * as React from 'react';

/**
 * Get network status synchronously
 */
export function getNetworkStatus(): NetworkStatus {
  return networkStatusMonitor.getStatus();
}

/**
 * Check if should use offline mode
 */
export function shouldUseOfflineMode(): boolean {
  const status = networkStatusMonitor.getStatus();
  return !status.isOnline || status.hasConnectionTimeout;
}
