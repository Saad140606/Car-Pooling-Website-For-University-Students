import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { CallingProvider } from '@/contexts/CallingContext';
import { IncomingCallScreen } from '@/components/calling/IncomingCallScreen';
import { ActiveCallScreen } from '@/components/calling/ActiveCallScreen';
import { BackgroundCallHandler } from '@/components/calling/BackgroundCallHandler';
import { PermissionRequester } from '@/components/premium/PermissionRequester';
import { RingtoneInitializer } from '@/hooks/useRingtoneInitializer';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import 'leaflet/dist/leaflet.css'; // CRITICAL: Import Leaflet CSS for markers, popups, and controls to render correctly.
import SafeConsolePatch from '@/components/SafeConsolePatch';
import { PWAServiceWorkerRegistration } from '@/components/pwa/PWAServiceWorkerRegistration';
import { PWAInstallPromptHandler } from '@/components/pwa/PWAInstallPromptHandler';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
};

export const metadata: Metadata = {
  title: 'Campus Rides',
  description: 'University carpooling, simplified.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Campus Rides',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://campusrides.app',
    siteName: 'Campus Rides',
    title: 'Campus Rides - University Carpooling',
    description: 'Efficient and affordable carpooling for university students. Share rides, split costs, and build community.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Campus Rides" />
        <meta name="msapplication-TileColor" content="#1f2937" />
        <meta name="msapplication-TileImage" content="/icons/icon-192x192.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* PWA Support */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/favicon-96x96.png" sizes="96x96" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" type="image/png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#1f2937" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
        {/* The Leaflet CSS is now imported at the top of the file */}
      </head>
      <body className="font-body antialiased">
        <SafeConsolePatch />
        <PWAServiceWorkerRegistration />
        <PWAInstallPromptHandler />
        <RingtoneInitializer />
        <GlobalErrorBoundary>
          <FirebaseClientProvider>
            <CallingProvider>
              <NotificationProvider>
                <BackgroundCallHandler />
                <PermissionRequester />
                <IncomingCallScreen />
                <ActiveCallScreen />
                {children}
              </NotificationProvider>
            </CallingProvider>
          </FirebaseClientProvider>
        </GlobalErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
