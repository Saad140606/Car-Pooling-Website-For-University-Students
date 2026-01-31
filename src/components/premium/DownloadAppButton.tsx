'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Loader2, Check, AlertCircle } from 'lucide-react';
import { downloadAppManager } from '@/lib/downloadAppManager';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface DownloadButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  /** Hide button completely when app is installed (default: true) */
  hideWhenInstalled?: boolean;
}

/**
 * Helper function to check if app is running in standalone/installed mode
 * This uses multiple detection methods for maximum reliability
 */
function isRunningAsInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Method 1: iOS standalone mode
  if ('standalone' in navigator && (navigator as any).standalone === true) {
    return true;
  }

  // Method 2: Display mode standalone (most reliable for Android PWA)
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }
    // Some browsers use minimal-ui for installed PWAs
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return true;
    }
  }

  // Method 3: Check if window has specific PWA characteristics
  // When installed, outer dimensions often equal inner dimensions (no browser chrome)
  if (window.outerWidth === window.innerWidth && 
      window.outerHeight === window.innerHeight &&
      window.screenTop === 0 && window.screenLeft === 0) {
    // Additional check: if URL bar is hidden, likely installed
    if (document.documentElement.scrollHeight === window.innerHeight) {
      return true;
    }
  }

  return false;
}

export const DownloadAppButton: React.FC<DownloadButtonProps> = ({
  variant = 'default',
  showText = true,
  size = 'default',
  className = '',
  hideWhenInstalled = true,
}) => {
  const pathname = usePathname();
  const [isInstallable, setIsInstallable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false); // Track recent installation
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Handle hydration by only showing device-specific content after mount
  useEffect(() => {
    setIsMounted(true);
    setDeviceType(downloadAppManager.getDeviceType());
    
    // Check if app is already running as installed app
    const alreadyInstalled = isRunningAsInstalledApp() || downloadAppManager.isAppInstalled();
    setIsInstalled(alreadyInstalled);
    
    // Listen for display mode changes (user might install while on page)
    const handleDisplayModeChange = () => {
      if (isRunningAsInstalledApp()) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };
    
    // Set up media query listeners for display mode changes
    if (typeof window.matchMedia === 'function') {
      const standaloneMQ = window.matchMedia('(display-mode: standalone)');
      const fullscreenMQ = window.matchMedia('(display-mode: fullscreen)');
      
      standaloneMQ.addEventListener?.('change', handleDisplayModeChange);
      fullscreenMQ.addEventListener?.('change', handleDisplayModeChange);
      
      return () => {
        standaloneMQ.removeEventListener?.('change', handleDisplayModeChange);
        fullscreenMQ.removeEventListener?.('change', handleDisplayModeChange);
      };
    }
  }, []);

  useEffect(() => {
    // Check if we should show the button
    if (!downloadAppManager.shouldShowDownloadButton(pathname)) {
      return;
    }

    // Check initial state
    setIsInstallable(downloadAppManager.isPWAInstallable());
    
    // Re-check installed state
    const alreadyInstalled = isRunningAsInstalledApp() || downloadAppManager.isAppInstalled();
    if (alreadyInstalled) {
      setIsInstalled(true);
      return; // Don't set up other listeners if already installed
    }

    // Subscribe to installable event
    const unsubscribeInstallable = downloadAppManager.subscribe('installable', ({ isInstallable }: any) => {
      console.log('[Download Button] Installable state changed:', isInstallable);
      setIsInstallable(isInstallable);
    });

    // Subscribe to installed event
    const unsubscribeInstalled = downloadAppManager.subscribe('installed', ({ success }: any) => {
      console.log('[Download Button] Installation event:', success);
      if (success) {
        setIsInstalled(true);
        setIsInstallable(false);
        setError(null);
        setJustInstalled(true);
        
        // Show "Installed!" state for 3 seconds, then hide button
        setTimeout(() => {
          setJustInstalled(false);
        }, 3000);
      }
    });

    // Subscribe to error events
    const unsubscribeError = downloadAppManager.subscribe('error', ({ message }: any) => {
      console.log('[Download Button] Error:', message);
      setError(message);
      
      // Clear error after 4 seconds
      setTimeout(() => {
        setError(null);
      }, 4000);
    });

    return () => {
      unsubscribeInstallable();
      unsubscribeInstalled();
      unsubscribeError();
    };
  }, [pathname]);

  // Don't show on dashboard/auth pages
  if (!downloadAppManager.shouldShowDownloadButton(pathname)) {
    return null;
  }

  // CRITICAL: Hide button completely when app is installed (not just recently)
  // Only show "Installed!" briefly after a successful install
  if (hideWhenInstalled && isInstalled && !justInstalled) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Ensure click is only on the button
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    setError(null);
    
    try {
      // CRITICAL: This must either install the app or download APK
      await downloadAppManager.handleDownloadApp();
    } catch (error) {
      console.error('[Download Button] Download error:', error);
      
      // If main handler fails, try APK download as last resort on Android
      const os = downloadAppManager.getOS();
      if (os === 'android') {
        try {
          console.log('[Download Button] Main handler failed, trying APK fallback');
          downloadAppManager.downloadAPK();
        } catch (apkError) {
          console.error('[Download Button] APK fallback also failed:', apkError);
          setError('Failed to start installation. Please try again.');
        }
      } else {
        setError('Failed to start installation. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Only trigger on Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    default: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <div className="inline-block">
      <Button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={isLoading || justInstalled}
        variant={justInstalled ? 'default' : variant}
        aria-label={justInstalled ? 'App installed' : 'Install app'}
        aria-busy={isLoading}
        className={`
          relative group
          ${sizeClasses[size]}
          ${justInstalled ? 'bg-green-500 hover:bg-green-600' : ''}
          ${error ? 'bg-red-500 hover:bg-red-600' : ''}
          transition-all duration-300 hover:scale-102 active:scale-98
          cursor-pointer
          ${className}
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {showText && <span>Installing...</span>}
          </>
        ) : justInstalled ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            {showText && <span>Installed!</span>}
          </>
        ) : error ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            {showText && <span>Error</span>}
          </>
        ) : (
          <>
            {/* Show appropriate icon based on device/installability */}
            {isInstallable || deviceType !== 'desktop' ? (
              <>
                <Smartphone className="w-4 h-4 mr-2" />
                {showText && <span>Get App</span>}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {showText && <span>Download App</span>}
              </>
            )}
          </>
        )}

        {/* Shine effect on hover - pointer-events-none prevents interaction */}
        <div
          className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, white, transparent)',
            transform: 'translateX(-100%)',
          }}
          aria-hidden="true"
        />
      </Button>
      
      {/* Error tooltip */}
      {error && (
        <div className="absolute top-full mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-xs whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * Download button with text (for header/navbar)
 */
export const DownloadAppButtonWithText: React.FC<DownloadButtonProps> = (props) => {
  return <DownloadAppButton {...props} showText={true} size="default" />;
};

/**
 * Download button icon only (for mobile)
 */
export const DownloadAppButtonIcon: React.FC<DownloadButtonProps> = (props) => {
  return <DownloadAppButton {...props} showText={false} size="sm" />;
};
