'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadAppManager } from '@/lib/downloadAppManager';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  installPromptAvailable: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOSCompatible: boolean;
  supportsWebApp: boolean;
  showManualPrompt: boolean;
}

/**
 * PWA Install Prompt Handler
 * 
 * Manages install prompts across different platforms:
 * - Android Chrome/Edge/Samsung/Brave: Automatic beforeinstallprompt
 * - iOS Safari: Manual "Add to Home Screen" instructions
 * - Desktop: Manual instructions for Chrome/Edge/Firefox/Safari
 * 
 * Uses feature detection rather than user-agent guessing for maximum reliability.
 */
export function PWAInstallPromptHandler() {
  const [state, setState] = useState<PWAInstallState>({
    installPromptAvailable: false,
    isInstallable: false,
    isInstalled: false,
    isIOSCompatible: false,
    supportsWebApp: false,
    showManualPrompt: false,
  });

  const [showInstallUI, setShowInstallUI] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [installationStatus, setInstallationStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
  const [hasInteracted, setHasInteracted] = useState(false);

  const INSTALL_PROMPT_DELAY_MS = 5 * 60 * 1000; // 5 minutes after website open
  const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
  const STORAGE_LAST_SHOWN = 'pwa_install_last_shown';
  const STORAGE_LAST_DISMISSED = 'pwa_install_last_dismissed';
  const SESSION_START_KEY = 'pwa_install_session_start';

  const canShowPrompt = () => {
    if (typeof window === 'undefined') return false;
    const now = Date.now();
    const lastShown = Number(window.localStorage.getItem(STORAGE_LAST_SHOWN) || 0);
    const lastDismissed = Number(window.localStorage.getItem(STORAGE_LAST_DISMISSED) || 0);
    if (now - lastShown < COOLDOWN_MS) return false;
    if (now - lastDismissed < COOLDOWN_MS) return false;
    return true;
  };

  const markShown = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_LAST_SHOWN, String(Date.now()));
  };

  const markDismissed = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_LAST_DISMISSED, String(Date.now()));
  };

  const getSessionStartMs = () => {
    if (typeof window === 'undefined') return Date.now();
    const existing = Number(window.sessionStorage.getItem(SESSION_START_KEY) || 0);
    if (existing > 0) return existing;
    const now = Date.now();
    window.sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  };

  const getRemainingDelayMs = () => {
    const elapsed = Date.now() - getSessionStartMs();
    return Math.max(0, INSTALL_PROMPT_DELAY_MS - elapsed);
  };

  const schedulePromptDisplay = () => {
    if (typeof window === 'undefined') return () => {};
    const remainingDelayMs = getRemainingDelayMs();

    const timeout = window.setTimeout(() => {
      if (dismissedCount === 0 && !isAlreadyInstalled() && canShowPrompt()) {
        markShown();
        setShowInstallUI(true);
      }
    }, remainingDelayMs);

    return () => window.clearTimeout(timeout);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markInteracted = () => setHasInteracted(true);
    window.addEventListener('scroll', markInteracted, { passive: true, once: true });
    window.addEventListener('click', markInteracted, { once: true });
    window.addEventListener('keydown', markInteracted, { once: true });

    return () => {
      window.removeEventListener('scroll', markInteracted as any);
      window.removeEventListener('click', markInteracted as any);
      window.removeEventListener('keydown', markInteracted as any);
    };
  }, []);

  /**
   * Detect if running on iOS using feature detection
   */
  const isIOSDevice = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    
    // Additional check: iOS has specific webkit prefix and touch support
    if (isIOS) {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    return false;
  };

  /**
   * Detect if already installed using multiple methods
   */
  const isAlreadyInstalled = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Method 1: Standalone mode (app installed)
    if (('standalone' in navigator) && (navigator as any).standalone === true) {
      return true;
    }

    // Method 2: Display mode is standalone or fullscreen
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already installed (app running in standalone mode)
    if (isAlreadyInstalled()) {
      setState(prev => ({ ...prev, isInstalled: true }));
      console.log('[PWA] App already installed (detected via display mode)');
      return;
    }

    // Detect platform using feature detection
    const ios = isIOSDevice();
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    const supportsSW = 'serviceWorker' in navigator;

    setState(prev => ({
      ...prev,
      isIOSCompatible: ios,
      supportsWebApp: hasManifest && supportsSW,
    }));

    // Listen for beforeinstallprompt (Android Chrome/Edge/Samsung/Brave/Opera)
    // This event ONLY fires on supported platforms
    const handleBeforeInstallPrompt = (event: Event) => {
      console.log('[PWA] beforeinstallprompt event fired - PWA installable');
      event.preventDefault();

      setState(prev => ({
        ...prev,
        installPromptAvailable: true,
        isInstallable: true,
      }));

      // Store the prompt for later use
      (window as any).deferredInstallPrompt = event as BeforeInstallPromptEvent;

      // Show install UI only after 5 minutes from website open.
      schedulePromptDisplay();
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      setState(prev => ({
        ...prev,
        isInstalled: true,
        installPromptAvailable: false,
      }));
      setShowInstallUI(false);
      setInstallationStatus('success');
      
      // Clear dismissal count after successful install
      setDismissedCount(0);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches && (e.media.includes('standalone') || e.media.includes('fullscreen'))) {
        console.log('[PWA] Display mode changed to:', e.media);
        setState(prev => ({ ...prev, isInstalled: true }));
        setShowInstallUI(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for display mode changes
    const standaloneMQ = window.matchMedia('(display-mode: standalone)');
    const fullscreenMQ = window.matchMedia('(display-mode: fullscreen)');
    
    if (typeof standaloneMQ.addEventListener === 'function') {
      standaloneMQ.addEventListener('change', handleDisplayModeChange);
      fullscreenMQ.addEventListener('change', handleDisplayModeChange);
    } else if (typeof standaloneMQ.addListener === 'function') {
      // Fallback for older browsers
      standaloneMQ.addListener(handleDisplayModeChange);
      fullscreenMQ.addListener(handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      
      if (typeof standaloneMQ.removeEventListener === 'function') {
        standaloneMQ.removeEventListener('change', handleDisplayModeChange);
        fullscreenMQ.removeEventListener('change', handleDisplayModeChange);
      } else if (typeof standaloneMQ.removeListener === 'function') {
        standaloneMQ.removeListener(handleDisplayModeChange);
        fullscreenMQ.removeListener(handleDisplayModeChange);
      }
    };
  }, [dismissedCount, hasInteracted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ensure this session has a stable start timestamp and schedule delayed prompt display.
    getSessionStartMs();

    if (dismissedCount > 0 || isAlreadyInstalled() || !canShowPrompt()) {
      return;
    }

    return schedulePromptDisplay();
  }, [dismissedCount]);

  /**
   * Check if desktop browser supports PWA
   */
  const checkDesktopSupport = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    // Chromium-based browsers support PWA
    return /chrome|edge|opera|brave|crios/.test(ua);
  };

  /**
   * Handle install button click - prompt user to install
   */
  const handleInstall = async () => {
    const deferredPrompt = (window as any).deferredInstallPrompt;

    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt available');

      // Android fallback: install prompt is unavailable, so start APK download directly.
      if (downloadAppManager.isAndroidDevice()) {
        downloadAppManager.downloadAPK(false);
        setShowInstallUI(false);
        return;
      }

      setState(prev => ({ ...prev, showManualPrompt: true }));
      return;
    }

    try {
      setInstallationStatus('installing');

      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Get user's response
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response: ${outcome}`);

      if (outcome === 'accepted') {
        setInstallationStatus('success');
        setState(prev => ({ ...prev, isInstalled: true }));
        setShowInstallUI(false);
        
        // Clear the stored prompt
        (window as any).deferredInstallPrompt = null;
      } else {
        // User dismissed the prompt
        setInstallationStatus('idle');
        setDismissedCount(prev => prev + 1);

        // Android fallback: if install is dismissed, continue with APK download.
        if (downloadAppManager.isAndroidDevice()) {
          downloadAppManager.downloadAPK(false);
          setShowInstallUI(false);
          return;
        }
        
        // Close UI after 2 seconds if dismissed
        setTimeout(() => {
          setShowInstallUI(false);
        }, 2000);
      }
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      setInstallationStatus('error');
      
      // Try again in 5 seconds
      setTimeout(() => {
        setInstallationStatus('idle');
      }, 5000);
    }
  };

  /**
   * Handle dismiss button click
   */
  const handleDismiss = () => {
    markDismissed();
    setShowInstallUI(false);
    setDismissedCount(prev => prev + 1);
  };

  /**
   * Render nothing if already installed
   */
  if (state.isInstalled) {
    return null;
  }

  /**
   * Don't show if dismissed 3+ times (persistent user preference)
   */
  if (dismissedCount >= 3) {
    return null;
  }

  /**
   * Render iOS manual installation instructions
   */
  if (state.isIOSCompatible && !state.installPromptAvailable && dismissedCount < 2) {
    return (
      <AnimatePresence>
        {showInstallUI && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-4 text-white">
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-2">Install Campus Rides</h3>
                  <ol className="text-xs space-y-1 opacity-90">
                    <li>1. Tap the Share button (⬆️)</li>
                    <li>2. Scroll & tap "Add to Home Screen"</li>
                    <li>3. Tap "Add" to confirm</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer p-1"
                  aria-label="Close install instructions"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  /**
   * Render Android/Desktop installation prompt
   */
  if (state.installPromptAvailable && dismissedCount < 2) {
    return (
      <AnimatePresence>
        {showInstallUI && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowInstallUI(false)}
            style={{ pointerEvents: 'auto' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg shadow-2xl p-6 max-w-sm w-full border border-slate-700"
              onClick={(e) => e.stopPropagation()}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center pointer-events-none">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-white">Install Campus Rides</h2>
                  <p className="text-sm text-slate-400">Tap Add to Home Screen for easy access</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5 pointer-events-none" />
                  <span>Works offline with cached content</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5 pointer-events-none" />
                  <span>One-tap access without browser UI</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5 pointer-events-none" />
                  <span>Faster loading and smoother experience</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleInstall}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install App
                </Button>
                <Button
                  type="button"
                  onClick={handleDismiss}
                  variant="outline"
                  className="flex-1 bg-slate-700 hover:bg-slate-600 border-slate-600 text-white cursor-pointer"
                >
                  Not Now
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4 pointer-events-none">
                You can always install later from the menu
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}
