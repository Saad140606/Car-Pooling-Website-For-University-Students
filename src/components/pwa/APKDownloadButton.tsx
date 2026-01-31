'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadAppManager } from '@/lib/downloadAppManager';

interface APKDownloadButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  onlyAndroid?: boolean; // Show only on Android devices
}

/**
 * APK Download Button Component
 * 
 * Features:
 * - Only shows on Android devices (mobile or tablet)
 * - Provides safety instructions
 * - Allows download of APK file as fallback
 * - Shows warning if device doesn't support PWA
 */
export const APKDownloadButton: React.FC<APKDownloadButtonProps> = ({
  variant = 'outline',
  showText = true,
  size = 'default',
  className = '',
  onlyAndroid = true,
}) => {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [hasPWASupport, setHasPWASupport] = useState(false);

  useEffect(() => {
    // Check if Android device
    const isAndroidDevice = downloadAppManager.isAndroidDevice();
    setIsAndroid(isAndroidDevice);

    // Check if PWA is supported
    const pwsInstallable = downloadAppManager.isPWAInstallable();
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    const hasSW = 'serviceWorker' in navigator;
    setHasPWASupport(pwsInstallable || (hasManifest && hasSW));
  }, []);

  // Don't show on non-Android devices (when onlyAndroid is true)
  if (onlyAndroid && !isAndroid) {
    return null;
  }

  const handleDownload = async () => {
    setIsLoading(true);
    setShowWarning(true);

    try {
      // Show warning about unknown sources
      const shouldContinue = confirm(
        'Android Security Notice:\n\n' +
        'This APK is from an unknown source.\n\n' +
        'If you haven\'t already, you may need to:\n' +
        '1. Open Settings → Apps → Special app access\n' +
        '2. Enable "Install unknown apps" for your browser\n\n' +
        'Proceed with download?'
      );

      if (shouldContinue) {
        downloadAppManager.downloadAPK();
      }
    } catch (error) {
      console.error('APK download error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    default: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  // Show APK button as fallback when PWA not supported
  if (!hasPWASupport && isAndroid) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="inline-block"
      >
        <Button
          onClick={handleDownload}
          disabled={isLoading}
          variant={variant}
          className={`
            relative group
            ${sizeClasses[size]}
            border-orange-500 text-orange-500 hover:bg-orange-500/10
            transition-all duration-300
            ${className}
          `}
          title="Download APK - Fallback when PWA is not available"
        >
          {isLoading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                <Download className="w-4 h-4 mr-2" />
              </motion.div>
              {showText && <span>Downloading...</span>}
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              {showText && <span>Download APK</span>}
            </>
          )}
        </Button>

        {/* Info tooltip */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileHover={{ opacity: 1, y: -5 }}
          className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
        >
          <div className="bg-slate-900 text-slate-100 text-xs rounded px-3 py-2 whitespace-nowrap border border-slate-700">
            Alternative installation method
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Don't show if PWA is fully supported
  return null;
};

/**
 * APK Download Warning Banner
 * Shows when user is on Android and PWA not available
 */
export const APKDownloadWarningBanner: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const [isAndroid, setIsAndroid] = useState(false);
  const [hasPWA, setHasPWA] = useState(false);

  useEffect(() => {
    const isAndroidDevice = downloadAppManager.isAndroidDevice();
    setIsAndroid(isAndroidDevice);

    const pwsInstallable = downloadAppManager.isPWAInstallable();
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    const hasSW = 'serviceWorker' in navigator;
    setHasPWA(pwsInstallable || (hasManifest && hasSW));
  }, []);

  // Only show on Android without PWA support
  if (!isAndroid || hasPWA) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900 mb-1">PWA Not Supported</h3>
          <p className="text-sm text-orange-800 mb-3">
            Your browser doesn't support PWA installation. You can download the APK file as an alternative.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => downloadAppManager.downloadAPK()}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm py-1 px-3 rounded"
            >
              <Download className="w-4 h-4 mr-1" />
              Download APK
            </Button>
            {onDismiss && (
              <Button
                onClick={onDismiss}
                variant="outline"
                className="text-sm py-1 px-3"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * APK Download Instructions for Android
 * Provides step-by-step guide for installing APK on Android
 */
export const APKInstallationInstructions: React.FC = () => {
  const [isAndroid, setIsAndroid] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsAndroid(downloadAppManager.isAndroidDevice());
  }, []);

  if (!isAndroid || dismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-white shadow-lg">
        <div className="flex items-start gap-3 mb-3">
          <Smartphone className="w-5 h-5 flex-shrink-0 text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-2">Installing APK on Android</h4>
            <ol className="text-xs space-y-1 text-slate-300">
              <li className="flex">
                <span className="mr-2">1.</span>
                <span>Download the APK file using the button above</span>
              </li>
              <li className="flex">
                <span className="mr-2">2.</span>
                <span>Open Settings → Apps & notifications</span>
              </li>
              <li className="flex">
                <span className="mr-2">3.</span>
                <span>Tap "Special app access" → "Install unknown apps"</span>
              </li>
              <li className="flex">
                <span className="mr-2">4.</span>
                <span>Enable for your browser (Chrome, Firefox, etc.)</span>
              </li>
              <li className="flex">
                <span className="mr-2">5.</span>
                <span>Open your Downloads folder and tap the APK</span>
              </li>
              <li className="flex">
                <span className="mr-2">6.</span>
                <span>Follow the installation prompts</span>
              </li>
            </ol>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </motion.div>
  );
};
