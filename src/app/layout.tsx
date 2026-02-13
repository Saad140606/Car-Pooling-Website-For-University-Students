import type {Metadata, Viewport} from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import dynamic from 'next/dynamic';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import SafeConsolePatch from '@/components/SafeConsolePatch';
import { PWAServiceWorkerRegistration } from '@/components/pwa/PWAServiceWorkerRegistration';

// ── PERF: Lazy load heavy providers that are only needed when user is authenticated ──
const NotificationProvider = dynamic(
  () => import('@/contexts/NotificationContext').then(m => ({ default: m.NotificationProvider })),
  { ssr: false }
);
const CallingProvider = dynamic(
  () => import('@/contexts/CallingContext').then(m => ({ default: m.CallingProvider })),
  { ssr: false }
);
const BackgroundCallHandler = dynamic(
  () => import('@/components/calling/BackgroundCallHandler').then(m => ({ default: m.BackgroundCallHandler })),
  { ssr: false }
);
const IncomingCallScreen = dynamic(
  () => import('@/components/calling/IncomingCallScreen').then(m => ({ default: m.IncomingCallScreen })),
  { ssr: false }
);
const ActiveCallScreen = dynamic(
  () => import('@/components/calling/ActiveCallScreen').then(m => ({ default: m.ActiveCallScreen })),
  { ssr: false }
);
const RingtoneInitializer = dynamic(
  () => import('@/hooks/useRingtoneInitializer').then(m => ({ default: m.RingtoneInitializer })),
  { ssr: false }
);
const PWAInstallPromptHandler = dynamic(
  () => import('@/components/pwa/PWAInstallPromptHandler').then(m => ({ default: m.PWAInstallPromptHandler })),
  { ssr: false }
);

// ── PERF: Use next/font instead of <link> for zero-FOUT font loading ──
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

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
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
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
