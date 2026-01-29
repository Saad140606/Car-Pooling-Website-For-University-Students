'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone, Loader2, Check } from 'lucide-react';
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

  useEffect(() => {
    // Check if we should show the button
    if (!downloadAppManager.shouldShowDownloadButton(pathname)) {
      return;
    }

    // Check if PWA is installable
    setIsInstallable(downloadAppManager.isPWAInstallable());

    // Subscribe to install events
    const unsubscribeInstallable = downloadAppManager.subscribe('installable', ({ isInstallable }: any) => {
      setIsInstallable(isInstallable);
    });

    const unsubscribeInstalled = downloadAppManager.subscribe('installed', ({ success }: any) => {
      if (success) {
        setIsInstalled(true);
        setIsInstallable(false);
        setTimeout(() => setIsInstalled(false), 3000);
      }
    });

    return () => {
      unsubscribeInstallable();
      unsubscribeInstalled();
    };
  }, [pathname]);

  // Don't show on dashboard/auth pages
  if (!downloadAppManager.shouldShowDownloadButton(pathname)) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await downloadAppManager.handleDownloadApp();
    } catch (error) {
      console.error('Download app error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    default: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="inline-block"
      style={{ pointerEvents: 'auto' }}
    >
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant={isInstalled ? 'default' : variant}
        className={`
          relative group
          ${sizeClasses[size]}
          ${isInstalled ? 'bg-green-500 hover:bg-green-600' : ''}
          transition-all duration-300
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
        ) : (
          <>
            {isInstallable || downloadAppManager.getDeviceType() !== 'desktop' ? (
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

        {/* Shine effect on hover */}
        <div
          className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-20 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(90deg, transparent, white, transparent)',
            transform: 'translateX(-100%)',
          }}
        />
      </Button>
    </motion.div>
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
