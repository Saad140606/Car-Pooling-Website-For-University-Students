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
}

export const DownloadAppButton: React.FC<DownloadButtonProps> = ({
  variant = 'default',
  showText = true,
  size = 'default',
  className = '',
}) => {
  const pathname = usePathname();
  const [isInstallable, setIsInstallable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Handle hydration by only showing device-specific content after mount
  useEffect(() => {
    setIsMounted(true);
    setDeviceType(downloadAppManager.getDeviceType());
  }, []);

  useEffect(() => {
    // Check if we should show the button
    if (!downloadAppManager.shouldShowDownloadButton(pathname)) {
      return;
    }

    // Check initial state
    setIsInstallable(downloadAppManager.isPWAInstallable());
    setIsInstalled(downloadAppManager.isAppInstalled());

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
        
        // Show installed state for 3 seconds
        setTimeout(() => {
          setIsInstalled(false);
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

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Ensure click is only on the button
    e.stopPropagation();
    
    setIsLoading(true);
    setError(null);
    
    try {
      await downloadAppManager.handleDownloadApp();
    } catch (error) {
      console.error('[Download Button] Download error:', error);
      setError('Failed to start installation. Please try again.');
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
        disabled={isLoading || isInstalled}
        variant={isInstalled ? 'default' : variant}
        aria-label={isInstalled ? 'App installed' : 'Install app'}
        aria-busy={isLoading}
        className={`
          relative group
          ${sizeClasses[size]}
          ${isInstalled ? 'bg-green-500 hover:bg-green-600' : ''}
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
        ) : isInstalled ? (
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
            {/* Always render Download icon on server, update to device-specific on client */}
            {isMounted && (isInstallable || deviceType !== 'desktop') ? (
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
