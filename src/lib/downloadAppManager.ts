/**
 * Download App Manager - Smart app installation and download detection
 * Auto-detects device type and offers appropriate installation method
 * 
 * Features:
 * - Feature detection (beforeinstallprompt) instead of user-agent guessing
 * - Android: PWA install + APK fallback
 * - iOS: Manual "Add to Home Screen" instructions
 * - Desktop: PWA install with browser-specific instructions
 * - HTTPS enforcement for PWA requirements
 * - Installation detection and button disabling
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class DownloadAppManager {
  private static instance: DownloadAppManager;
  private deferredPrompt: InstallPromptEvent | null = null;
  private isInstallable = false;
  private isInstalled = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private manifestLoaded = false;

  // APK download link (configure as needed)
  private APK_DOWNLOAD_URL = '/downloads/campus-rides.apk';

  private constructor() {
    this.initializeInstallPrompt();
    this.validatePWARequirements();
  }

  static getInstance(): DownloadAppManager {
    if (!DownloadAppManager.instance) {
      DownloadAppManager.instance = new DownloadAppManager();
    }
    return DownloadAppManager.instance;
  }

  /**
   * Validate PWA requirements (HTTPS, manifest, service worker)
   */
  private validatePWARequirements(): void {
    if (typeof window === 'undefined') return;

    const checks = {
      isHttps: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      hasManifest: !!document.querySelector('link[rel="manifest"]'),
      supportsSW: 'serviceWorker' in navigator,
      supportsInstallPrompt: 'beforeinstallprompt' in window,
    };

    console.log('[PWA] Validation:', checks);

    if (!checks.isHttps) {
      console.warn('[PWA] HTTPS is required for PWA features. Currently on HTTP.');
    }
    if (!checks.hasManifest) {
      console.warn('[PWA] Web manifest not found. Add link[rel="manifest"] to head.');
    }
    if (!checks.supportsSW) {
      console.warn('[PWA] Service Workers not supported in this browser.');
    }
  }

  /**
   * Initialize PWA install prompt listener with feature detection
   */
  private initializeInstallPrompt() {
    if (typeof window === 'undefined') return;

    // Check if already in standalone mode (app already installed)
    const isStandalone = ('standalone' in navigator) && (navigator as any).standalone === true;
    if (isStandalone) {
      this.isInstalled = true;
      this.emit('installed', { success: true });
      console.log('[PWA] App is already installed (standalone mode detected)');
      return;
    }

    // Feature detection: beforeinstallprompt - ONLY fires on supported platforms
    // This is the most reliable way to detect PWA install capability
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as InstallPromptEvent;
      this.isInstallable = true;
      this.emit('installable', { isInstallable: true });
      console.log('[PWA] beforeinstallprompt available - PWA installable');
    });

    // Check if app is already installed (triggered after successful installation)
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.isInstalled = true;
      this.emit('installed', { success: true });
      this.deferredPrompt = null;
      this.isInstallable = false;
    });

    // Additional detection: Check for display mode
    // If app is running in standalone or fullscreen, it's installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches) {
      this.isInstalled = true;
      console.log('[PWA] App running in standalone/fullscreen mode');
    }

    // Listen for changes to display mode
    window.matchMedia('(display-mode: standalone)').addListener(media => {
      if (media.matches) {
        this.isInstalled = true;
        this.emit('installed', { success: true });
      }
    });
  }

  /**
   * Set APK download URL
   */
  setAPKDownloadURL(url: string): void {
    this.APK_DOWNLOAD_URL = url;
  }

  /**
   * Get APK download URL
   */
  getAPKDownloadURL(): string {
    return this.APK_DOWNLOAD_URL;
  }

  /**
   * Check if device is Android
   */
  isAndroidDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /android/i.test(navigator.userAgent);
  }

  /**
   * Check if device is iOS
   */
  isIOSDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  }

  /**
   * Get device type using feature detection
   */
  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';

    // Feature detection: touch support
    const hasTouchSupport = () => {
      return (('ontouchstart' in window) ||
              ('onmsgesturechange' in window) ||
              (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
              ((navigator as any).msMaxTouchPoints && (navigator as any).msMaxTouchPoints > 0));
    };

    // Screen size detection
    const screenWidth = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();

    // If no touch support, it's desktop
    if (!hasTouchSupport()) {
      return 'desktop';
    }

    // Tablet detection: larger screen with touch
    if (screenWidth >= 768) {
      // Additional check: iPad Pro looks like desktop but is tablet
      if (/ipad|android(?!.*mobile)/.test(ua)) {
        return 'tablet';
      }
      // If very large and touch, likely tablet
      return screenWidth >= 1024 ? 'tablet' : 'mobile';
    }

    return 'mobile';
  }

  /**
   * Get OS type using feature detection and UA as fallback
   */
  getOS(): 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown';

    const ua = navigator.userAgent.toLowerCase();

    // iOS detection
    if (/iphone|ipad|ipod|mac/i.test(ua)) {
      // Additional check: Mac with touch support is likely iPad
      if (/ipad/i.test(ua) || (/(mac|iphone|ipod)/i.test(ua) && 'ontouchstart' in window)) {
        return 'ios';
      }
      if (/mac/i.test(ua)) return 'mac';
    }

    if (/android/.test(ua)) return 'android';
    if (/windows/.test(ua)) return 'windows';
    if (/macintosh|macintel/.test(ua)) return 'mac';
    if (/linux/.test(ua)) return 'linux';

    return 'unknown';
  }

  /**
   * Get browser name using feature detection
   * Returns browser with highest confidence
   */
  getBrowserName(): string {
    if (typeof window === 'undefined') return 'unknown';

    const ua = navigator.userAgent;

    // Chromium-based browsers (must check Edge before Chrome)
    if (/edg/i.test(ua)) return 'Edge';
    if (/chrome|chromium|crios/i.test(ua) && !/edg/i.test(ua)) {
      // Distinguish Chrome from other Chromium browsers
      if (/crios/i.test(ua)) return 'Chrome (iOS)';
      return 'Chrome';
    }

    // Samsung Internet
    if (/samsungbrowser|samsung/i.test(ua)) return 'Samsung Internet';

    // Opera (must check before Firefox)
    if (/opera|opr/i.test(ua)) return 'Opera';

    // Firefox
    if (/firefox|fxios/i.test(ua)) return 'Firefox';

    // Safari (must check last as it shares many markers)
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      if (/iphone|ipad|ipod/.test(ua.toLowerCase())) {
        return 'Safari (iOS)';
      }
      return 'Safari';
    }

    // Brave (uses Chromium, check user agent)
    if (/brave/i.test(ua)) return 'Brave';

    return 'unknown';
  }

  /**
   * Check if PWA install is supported
   */
  isPWAInstallable(): boolean {
    if (typeof window === 'undefined') return false;
    this.syncDeferredPrompt();
    return this.isInstallable;
  }

  /**
   * Check if app is already installed
   */
  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Trigger PWA install prompt
   */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('[DownloadApp] Install prompt not available');
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[DownloadApp] User accepted install');
        return true;
      } else {
        console.log('[DownloadApp] User dismissed install');
        return false;
      }
    } catch (error) {
      console.error('[DownloadApp] Install prompt error:', error);
      return false;
    }
  }

  /**
   * Download APK file (Android fallback)
   * CRITICAL: This MUST trigger a download. No silent failures allowed.
   */
  downloadAPK(): void {
    try {
      console.log('[DownloadApp] Downloading APK:', this.APK_DOWNLOAD_URL);
      
      // Show user what's happening
      const proceed = confirm(
        '📱 Download Campus Rides APK\n\n' +
        'The APK file will be downloaded to your device.\n\n' +
        '⚠️ After download, you may need to:\n' +
        '1. Open your Downloads folder\n' +
        '2. Tap the APK file to install\n' +
        '3. If prompted, enable "Install from unknown sources"\n\n' +
        'Tap OK to start download.'
      );
      
      if (!proceed) {
        console.log('[DownloadApp] User cancelled APK download');
        return;
      }
      
      // Method 1: Try creating a download link
      const link = document.createElement('a');
      link.href = this.APK_DOWNLOAD_URL;
      link.download = 'campus-rides.apk';
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

      this.emit('download-started', { method: 'apk', success: true });
      
      // Show success message after a short delay
      setTimeout(() => {
        alert('✅ Download started!\n\nCheck your Downloads folder or notification bar for the APK file.');
      }, 500);
      
    } catch (error) {
      console.error('[DownloadApp] APK download error:', error);
      
      // Method 2: Fallback - Open download URL directly
      try {
        console.log('[DownloadApp] Trying fallback: window.open');
        window.open(this.APK_DOWNLOAD_URL, '_blank');
        this.emit('download-started', { method: 'apk-fallback', success: true });
      } catch (e2) {
        console.error('[DownloadApp] Fallback also failed:', e2);
        
        // Method 3: Last resort - navigate to download URL
        try {
          window.location.href = this.APK_DOWNLOAD_URL;
        } catch (e3) {
          console.error('[DownloadApp] All download methods failed');
          alert('❌ Download failed\n\nPlease try again or visit:\n' + this.APK_DOWNLOAD_URL);
        }
      }
      
      this.emit('download-started', { method: 'apk', success: false });
    }
  }

  /**
   * Get app store link based on OS
   */
  getAppStoreLink(): string {
    const os = this.getOS();

    if (os === 'ios') {
      // iOS App Store link (update with actual app ID)
      return 'https://apps.apple.com/app/campus-rides/id1234567890';
    }

    if (os === 'android') {
      // Google Play Store link (update with actual package name)
      return 'https://play.google.com/store/apps/details?id=com.campusrides.app';
    }

    return window.location.origin;
  }

  /**
   * Handle download app action - main entry point
   * Routes to appropriate installation method based on platform and browser
   * 
   * CRITICAL: This MUST either install the PWA or download the APK. No silent failures.
   */
  async handleDownloadApp(): Promise<void> {
    try {
      this.syncDeferredPrompt();
      const deviceType = this.getDeviceType();
      const os = this.getOS();
      const browser = this.getBrowserName();

      console.log('[PWA] Download requested:', { deviceType, os, browser, isInstallable: this.isInstallable, hasPrompt: !!this.deferredPrompt });

      // Check if app is already installed
      if (this.isInstalled) {
        console.log('[PWA] App already installed');
        alert('✅ Campus Rides is already installed!\n\nLook for the app icon on your home screen or in your apps list.');
        this.emit('download-started', { method: 'already-installed', success: true });
        return;
      }

      // Verify HTTPS before proceeding (PWA requirement)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        const error = 'HTTPS required for PWA installation';
        console.warn('[PWA]', error);
        // On Android, fallback to APK download instead of just showing error
        if (os === 'android') {
          console.log('[PWA] HTTP detected on Android, falling back to APK download');
          this.downloadAPK();
          return;
        }
        this.emit('error', { message: error });
        return;
      }

      // Primary: Try PWA install (works on Chrome, Edge, Samsung Internet, Brave, Opera)
      if (this.isPWAInstallable() && this.deferredPrompt) {
        try {
          console.log('[PWA] Attempting PWA install via beforeinstallprompt');
          const installed = await this.promptInstall();
          if (installed) {
            console.log('[PWA] PWA install successful');
            this.emit('download-started', { method: 'pwa', success: true });
            return;
          } else {
            console.log('[PWA] User dismissed PWA install prompt');
            // User dismissed - on Android offer APK as alternative
            if (os === 'android') {
              const downloadAPK = confirm(
                '📱 Would you like to download the APK instead?\n\n' +
                'The APK file can be installed manually on your device.'
              );
              if (downloadAPK) {
                this.downloadAPK();
                return;
              }
            }
          }
        } catch (error) {
          console.error('[PWA] PWA install failed:', error);
          // On Android, automatically fallback to APK
          if (os === 'android') {
            console.log('[PWA] PWA install failed on Android, falling back to APK');
            this.downloadAPK();
            return;
          }
        }
      } else if (os === 'android') {
        // No install prompt available on Android - immediately download APK
        console.log('[PWA] No install prompt on Android, downloading APK directly');
        this.downloadAPK();
        return;
      }

      // Route based on OS for non-Android devices
      switch (os) {
        case 'ios':
          this.handleIOSInstall();
          break;
        case 'android':
          // Should have been handled above, but just in case
          this.downloadAPK();
          break;
        default:
          // Desktop or unknown
          if (deviceType === 'desktop') {
            this.handleDesktopInstall(browser);
          } else {
            this.showInstallInstructions('fallback');
            this.emit('download-started', { method: 'fallback', success: true });
          }
      }
    } catch (error) {
      console.error('[PWA] Unexpected error in handleDownloadApp:', error);
      // Last resort fallback - try APK download on Android
      if (this.getOS() === 'android') {
        console.log('[PWA] Error occurred, attempting APK fallback');
        try {
          this.downloadAPK();
        } catch (e) {
          console.error('[PWA] APK fallback also failed:', e);
        }
      }
      this.emit('error', { message: 'An unexpected error occurred. Please try again.' });
    }
  }

  /**
   * Sync install prompt from global handler if present
   */
  private syncDeferredPrompt(): void {
    if (typeof window === 'undefined') return;
    const globalPrompt = (window as any).deferredInstallPrompt as InstallPromptEvent | undefined;
    if (globalPrompt && !this.deferredPrompt) {
      this.deferredPrompt = globalPrompt;
      this.isInstallable = true;
      this.emit('installable', { isInstallable: true });
    }
  }

  /**
   * Handle iOS installation flow
   * iOS does not support beforeinstallprompt, show manual instructions
   */
  private handleIOSInstall(): void {
    console.log('[PWA] Handling iOS installation');
    this.showInstallInstructions('ios');
    this.emit('download-started', { method: 'ios-instructions', success: true });
  }

  /**
   * Handle Android installation flow
   * Try PWA first, then offer APK as fallback
   */
  private handleAndroidInstall(browser: string): void {
    console.log('[PWA] Handling Android installation');

    // Chromium-based browsers support PWA
    if (/chrome|edge|samsung|brave|opera/i.test(browser)) {
      this.showInstallInstructions('android-chrome');
      this.emit('download-started', { method: 'android-pwa', success: true });
    } else if (/firefox/i.test(browser)) {
      // Firefox on Android doesn't support beforeinstallprompt yet
      // Offer APK download or store link
      this.showInstallInstructions('android-firefox');
      this.emit('download-started', { method: 'android-firefox', success: true });
    } else {
      // Fallback to APK
      this.showInstallInstructions('android-apk-available');
      this.emit('download-started', { method: 'android-apk', success: true });
    }
  }

  /**
   * Handle desktop installation flow
   * Desktop browsers have different PWA install mechanisms
   */
  private handleDesktopInstall(browser: string): void {
    console.log('[PWA] Handling desktop installation');

    if (/chrome|edge|opera|brave/i.test(browser)) {
      // Chromium-based browsers show address bar install button
      if (/edge/i.test(browser)) {
        this.showInstallInstructions('desktop-edge');
      } else if (/opera/i.test(browser)) {
        this.showInstallInstructions('desktop-opera');
      } else {
        // Chrome/Brave
        this.showInstallInstructions('desktop-chrome');
      }
    } else if (/firefox/i.test(browser)) {
      this.showInstallInstructions('desktop-firefox');
    } else if (/safari/i.test(browser)) {
      this.showInstallInstructions('desktop-safari');
    } else {
      this.showInstallInstructions('desktop-other');
    }

    this.emit('download-started', { method: 'desktop-instructions', success: true });
  }

  /**
   * Show platform-specific install instructions via alert or UI integration
   */
  private showInstallInstructions(platform: string): void {
    const instructions: { [key: string]: string } = {
      'ios': '📱 Install Campus Rides on iPhone/iPad:\n\n' +
             '1. Tap the Share button (⬆️) at the bottom\n' +
             '2. Scroll down and tap "Add to Home Screen"\n' +
             '3. Enter a name and tap "Add"\n\n' +
             '✨ The app will appear on your home screen!\n\n' +
             'Open it like any other app - no browser interface!',
      
      'android-chrome': '📱 Install Campus Rides on Android:\n\n' +
                        'Chrome, Edge, or Brave should show an install prompt.\n\n' +
                        'If you don\'t see it:\n' +
                        '1. Tap the menu icon (⋮) in the top right\n' +
                        '2. Tap "Install app" or "Add to Home Screen"\n' +
                        '3. Tap "Install" to confirm\n\n' +
                        '✨ The app will appear on your home screen!',
      
      'android-firefox': '📱 Firefox on Android:\n\n' +
                         'Full PWA installation isn\'t available yet in Firefox for Android.\n' +
                         'However, you can bookmark this page for quick access:\n\n' +
                         '1. Tap the menu (⋮)\n' +
                         '2. Tap "Bookmark this page"\n' +
                         '3. Long press the bookmark and select "Add to home screen"',
      
      'android-apk-available': '📱 Download Campus Rides APK:\n\n' +
                               'Your browser doesn\'t support PWA installation.\n' +
                               'You can download the APK file instead.\n\n' +
                               '⚠️ Make sure "Install from unknown sources" is enabled in Settings:\n' +
                               'Settings → Security → Unknown Sources',
      
      'android-other': '📱 To use Campus Rides as an app:\n\n' +
                       '• Install Chrome or Brave from Google Play\n' +
                       '• Open Campus Rides in Chrome\n' +
                       '• Tap the menu and select "Install app"\n\n' +
                       '✨ Or continue using it in your current browser!',
      
      'desktop-chrome': '💻 Install Campus Rides on your computer:\n\n' +
                        'Chrome should show an install icon (⊕) in the address bar.\n\n' +
                        'If you don\'t see it:\n' +
                        '1. Click the menu (⋮) in the top right\n' +
                        '2. Click "Install Campus Rides"\n' +
                        '3. Choose where to install\n\n' +
                        '✨ Access from your desktop or Start Menu!\n\n' +
                        'Works offline and launches in standalone mode.',
      
      'desktop-edge': '💻 Install Campus Rides on Windows:\n\n' +
                      'Edge should show an install icon in the address bar.\n\n' +
                      'If you don\'t see it:\n' +
                      '1. Click the menu (⋮) in the top right\n' +
                      '2. Select "Install this site as an app"\n' +
                      '3. Review and click "Install"\n\n' +
                      '✨ Campus Rides will appear in your Start Menu!',
      
      'desktop-opera': '💻 Install Campus Rides with Opera:\n\n' +
                       '1. Look for the install icon in the address bar\n' +
                       '2. Click "Install" when prompted\n\n' +
                       '✨ Access Campus Rides from your desktop!',
      
      'desktop-firefox': '💻 Campus Rides in Firefox:\n\n' +
                         'Full PWA installation isn\'t available yet.\n\n' +
                         'However, you can:\n' +
                         '• Bookmark this page (Ctrl+D) for quick access\n' +
                         '• Pin it to your taskbar (right-click bookmark)\n' +
                         '• Use it directly in Firefox\n\n' +
                         '💡 For full PWA features, try Chrome or Edge',
      
      'desktop-safari': '💻 Campus Rides on Mac:\n\n' +
                        'Full PWA installation isn\'t available in Safari yet.\n\n' +
                        'However, you can:\n' +
                        '• Bookmark this page (Cmd+D) for quick access\n' +
                        '• Add to Dock: Shift+Cmd+D or File → Add to Dock\n' +
                        '• Use directly in Safari\n\n' +
                        '💡 For PWA support, try Chrome or Edge (Mac versions)',
      
      'desktop-other': '💻 Campus Rides is a web app!\n\n' +
                       '• Bookmark this page for easy access\n' +
                       '• Use it directly in your browser\n\n' +
                       '✨ No download needed - it works right in your browser!',
      
      'fallback': '✨ Welcome to Campus Rides!\n\n' +
                  'This is a web app that works right in your browser.\n\n' +
                  '📌 Bookmark this page for quick access!\n\n' +
                  'Get a faster, app-like experience with offline support.'
    };

    const message = instructions[platform] || instructions['fallback'];
    console.log(`[PWA] Showing ${platform} instructions`);
    alert(message);
  }

  /**
   * Get download button visibility (not on dashboard/auth pages)
   */
  shouldShowDownloadButton(pathname: string): boolean {
    if (!pathname) return true;

    // Hide on dashboard and authenticated pages
    const hiddenPaths = [
      '/dashboard',
      '/auth',
      '/chat',
      '/rides/offer',
      '/profile',
      '/settings',
    ];

    return !hiddenPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Subscribe to events
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)!.delete(callback);
    };
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error('[DownloadApp] Event callback error:', error);
        }
      });
    }
  }

  /**
   * Get download status info
   */
  getStatus(): {
    isInstallable: boolean;
    isInstalled: boolean;
    deviceType: 'mobile' | 'tablet' | 'desktop';
    os: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
    browser: string;
    recommendedMethod: 'pwa' | 'apk' | 'app-store' | 'web';
  } {
    const deviceType = this.getDeviceType();
    const os = this.getOS();
    const browser = this.getBrowserName();

    let recommendedMethod: 'pwa' | 'apk' | 'app-store' | 'web' = 'web';

    if (this.isInstalled) {
      recommendedMethod = 'web';
    } else if (this.isPWAInstallable()) {
      recommendedMethod = 'pwa';
    } else if (os === 'android') {
      recommendedMethod = 'apk';
    } else if (deviceType === 'mobile' && os === 'ios') {
      recommendedMethod = 'app-store';
    }

    return {
      isInstallable: this.isInstallable,
      isInstalled: this.isInstalled,
      deviceType,
      os,
      browser,
      recommendedMethod,
    };
  }
}

// Export singleton instance
export const downloadAppManager = DownloadAppManager.getInstance();
