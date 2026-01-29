import type {Metadata} from 'next';
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

export const metadata: Metadata = {
  title: 'Campus Rides',
  description: 'University carpooling, simplified.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
        {/* The Leaflet CSS is now imported at the top of the file */}
      </head>
      <body className="font-body antialiased">
        <SafeConsolePatch />
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
