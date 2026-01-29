/**
 * Download App Manager - Smart app installation and download detection
 * Auto-detects device type and offers appropriate installation method
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class DownloadAppManager {
  private static instance: DownloadAppManager;
  private deferredPrompt: InstallPromptEvent | null = null;
  private isInstallable = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  private constructor() {
    this.initializeInstallPrompt();
  }

  static getInstance(): DownloadAppManager {
    if (!DownloadAppManager.instance) {
      DownloadAppManager.instance = new DownloadAppManager();
    }
    return DownloadAppManager.instance;
  }

  /**
   * Initialize PWA install prompt listener
   */
  private initializeInstallPrompt() {
    if (typeof window === 'undefined') return;

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as InstallPromptEvent;
      this.isInstallable = true;
      this.emit('installable', { isInstallable: true });
      console.log('[DownloadApp] PWA install prompt available');
    });

    // Check if app is already installed
    window.addEventListener('appinstalled', () => {
      console.log('[DownloadApp] App installed successfully');
      this.emit('installed', { success: true });
      this.deferredPrompt = null;
      this.isInstallable = false;
    });
  }

  /**
   * Get device type
   */
  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';

    const ua = navigator.userAgent.toLowerCase();

    // Mobile detection
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      if (/ipad|android(?!.*mobile)/.test(ua)) {
        return 'tablet';
      }
      return 'mobile';
    }

    return 'desktop';
  }

  /**
   * Get OS type
   */
  getOS(): 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown';

    const ua = navigator.userAgent.toLowerCase();

    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/windows/.test(ua)) return 'windows';
    if (/macintosh|macintel/.test(ua)) return 'mac';
    if (/linux/.test(ua)) return 'linux';

    return 'unknown';
  }

  /**
   * Check if PWA install is supported
   */
  isPWAInstallable(): boolean {
    if (typeof window === 'undefined') return false;
    return this.isInstallable;
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
   * Get app store link based on OS
   */
  getAppStoreLink(): string {
    const os = this.getOS();

    // Since there's no native app yet, just return the web app URL
    // Users will get instructions to add to home screen
    return window.location.origin;
  }

  /**
   * Handle download app action
   */
  async handleDownloadApp(): Promise<void> {
    const deviceType = this.getDeviceType();
    const os = this.getOS();

    console.log('[DownloadApp] Download requested - Device:', deviceType, 'OS:', os);

    // Try PWA install first (works on Chrome, Edge, Samsung Internet)
    if (this.isPWAInstallable()) {
      const installed = await this.promptInstall();
      if (installed) {
        this.emit('download-started', { method: 'pwa', success: true });
        return;
      }
    }

    // iOS Safari - Show instructions to add to home screen
    if (os === 'ios') {
      const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
      
      if (!isInStandaloneMode) {
        this.showInstallInstructions('ios');
        this.emit('download-started', { method: 'ios-instructions', success: true });
        return;
      } else {
        // Already installed as PWA
        alert('Campus Ride is already installed on your device!');
        return;
      }
    }

    // Android - Try different install methods
    if (os === 'android') {
      // Check if running in Chrome/Edge (supports PWA)
      const isChrome = /chrome|chromium|crios/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent);
      const isEdge = /edg/i.test(navigator.userAgent);
      const isSamsung = /samsungbrowser/i.test(navigator.userAgent);
      
      if (isChrome || isEdge || isSamsung) {
        this.showInstallInstructions('android-chrome');
      } else {
        // Firefox or other browsers on Android
        this.showInstallInstructions('android-other');
      }
      this.emit('download-started', { method: 'android-instructions', success: true });
      return;
    }

    // Desktop browsers (Windows, Mac, Linux)
    if (deviceType === 'desktop') {
      // Check browser support
      const isChrome = /chrome/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent);
      const isEdge = /edg/i.test(navigator.userAgent);
      const isOpera = /opr|opera/i.test(navigator.userAgent);
      
      if (isChrome || isEdge || isOpera) {
        this.showInstallInstructions('desktop-chrome');
      } else if (/firefox/i.test(navigator.userAgent)) {
        this.showInstallInstructions('desktop-firefox');
      } else if (/safari/i.test(navigator.userAgent)) {
        this.showInstallInstructions('desktop-safari');
      } else {
        this.showInstallInstructions('desktop-other');
      }
      this.emit('download-started', { method: 'desktop-instructions', success: true });
      return;
    }

    // Fallback for any other scenario
    this.showInstallInstructions('fallback');
    this.emit('download-started', { method: 'fallback', success: true });
  }

  /**
   * Show platform-specific install instructions
   */
  private showInstallInstructions(platform: string): void {
    const instructions: { [key: string]: string } = {
      'ios': '📱 Install Campus Ride on iPhone/iPad:\n\n' +
             '1. Tap the Share button (⬆️) at the bottom\n' +
             '2. Scroll down and tap "Add to Home Screen"\n' +
             '3. Tap "Add" to install\n\n' +
             '✨ The app will appear on your home screen!',
      
      'android-chrome': '📱 Install Campus Ride on Android:\n\n' +
                        '1. Tap the menu (⋮) in the top right corner\n' +
                        '2. Tap "Install app" or "Add to Home screen"\n' +
                        '3. Tap "Install" to confirm\n\n' +
                        '✨ The app will appear on your home screen!',
      
      'android-other': '📱 To use Campus Ride as an app:\n\n' +
                       '• Open this site in Chrome or Samsung Internet\n' +
                       '• Tap the menu and select "Install app"\n\n' +
                       '✨ Or continue using it in your browser!',
      
      'desktop-chrome': '💻 Install Campus Ride on your computer:\n\n' +
                        '1. Look for the install icon (⊕) in the address bar\n' +
                        '2. Click it and select "Install"\n\n' +
                        '✨ Or use it directly in your browser!',
      
      'desktop-firefox': '💻 Campus Ride is a web app!\n\n' +
                         '• Bookmark this page (Ctrl+D / Cmd+D)\n' +
                         '• Use it directly in your browser\n\n' +
                         '💡 For PWA support, try Chrome or Edge',
      
      'desktop-safari': '💻 Campus Ride on Mac:\n\n' +
                        '• Bookmark this page for quick access\n' +
                        '• Add to Dock: File → Add to Dock\n' +
                        '• Use directly in Safari\n\n' +
                        '💡 For PWA support, try Chrome or Edge',
      
      'desktop-other': '💻 Campus Ride is a web app!\n\n' +
                       '• Bookmark this page for easy access\n' +
                       '• Use it directly in your browser\n\n' +
                       '✨ No download needed!',
      
      'fallback': '✨ Welcome to Campus Ride!\n\n' +
                  'This is a web app that works right in your browser.\n\n' +
                  '📌 Bookmark this page for quick access!'
    };

    const message = instructions[platform] || instructions['fallback'];
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
    deviceType: 'mobile' | 'tablet' | 'desktop';
    os: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'unknown';
    recommendedMethod: 'pwa' | 'app-store' | 'web';
  } {
    const deviceType = this.getDeviceType();
    const os = this.getOS();

    let recommendedMethod: 'pwa' | 'app-store' | 'web' = 'web';

    if (this.isPWAInstallable()) {
      recommendedMethod = 'pwa';
    } else if (deviceType === 'mobile' && (os === 'android' || os === 'ios')) {
      recommendedMethod = 'app-store';
    }

    return {
      isInstallable: this.isInstallable,
      deviceType,
      os,
      recommendedMethod,
    };
  }
}

// Export singleton instance
export const downloadAppManager = DownloadAppManager.getInstance();
