'use client';

import { useEffect, useState } from 'react';

/**
 * PWA Service Worker Registration Component
 * 
 * Handles service worker registration with proper error handling,
 * update detection, and debugging capabilities.
 * 
 * Features:
 * - Registers service worker on app load
 * - Detects updates and prompts user
 * - Handles permission requests
 * - Provides debug information
 */
export function PWAServiceWorkerRegistration() {
  const [registered, setRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swReady, setSWReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (process.env.NODE_ENV === 'development') {
      const cleanupDevServiceWorkers = async () => {
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          }

          if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
          }

          console.log('[PWA] Development mode: service workers unregistered and caches cleared');
        } catch (error) {
          console.warn('[PWA] Development cleanup failed:', error);
        }
      };

      cleanupDevServiceWorkers();
      return;
    }

    // Only register if HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      console.warn('[PWA] Service workers require HTTPS (except localhost)');
      return;
    }

    // Only register if browser supports service workers
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] This browser does not support service workers');
      return;
    }

    registerServiceWorker();
  }, []);

  /**
   * Register and manage service worker lifecycle
   */
  const registerServiceWorker = async () => {
    try {
      console.log('[PWA] Registering service worker...');

      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none', // Always fetch fresh service-worker.js
      });

      console.log('[PWA] Service worker registered successfully', registration);
      setRegistered(true);
      setSWReady(true);

      /**
       * Handle service worker updates
       * When a new version is available, notify the user
       */
      registration.addEventListener('updatefound', () => {
        console.log('[PWA] Service worker update found');

        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[PWA] New service worker activated');

            // Only show update prompt if there was already an active worker
            // (Skip on first install)
            if (registration.active) {
              setUpdateAvailable(true);

              // Auto-prompt user after delay
              setTimeout(() => {
                promptUserUpdate(registration);
              }, 2000);
            }
          }
        });
      });

      /**
       * Monitor service worker state changes
       */
      if ((navigator.serviceWorker as any).controller) {
        console.log('[PWA] Service worker already controlling this page');
      }

      // Handle controller change (when new SW becomes active)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service worker controller changed - new version active');
        // Page is now controlled by the new service worker
      });

    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
      setRegistered(false);
    }
  };

  /**
   * Prompt user to update the app
   */
  const promptUserUpdate = (registration: ServiceWorkerRegistration) => {
    if (!updateAvailable) return;

    const message = 'Campus Rides has been updated! Refresh to get the latest version.';

    // You can also use a custom UI component here instead of alert
    // This is just a simple implementation
    if (confirm(message + '\n\nRefresh now?')) {
      updateServiceWorker(registration);
    }
  };

  /**
   * Update service worker and reload page
   */
  const updateServiceWorker = (registration: ServiceWorkerRegistration) => {
    const newWorker = registration.installing || registration.waiting;
    if (!newWorker) return;

    newWorker.postMessage({ type: 'SKIP_WAITING' });

    // Reload page once new SW is active
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  };

  // Notification permission requests should be initiated via explicit user action.

  /**
   * Manually handle updates when PWA is installed
   */
  const handlePWAUpdate = () => {
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    setUpdateAvailable(false);
    window.location.reload();
  };

  // Debugging info (remove in production if needed)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PWA] Status:', {
        serviceWorkerSupported: 'serviceWorker' in navigator,
        serviceWorkerRegistered: registered,
        serviceWorkerReady: swReady,
        updateAvailable,
      });
    }
  }, [registered, swReady, updateAvailable]);

  return null; // This component doesn't render anything
}
