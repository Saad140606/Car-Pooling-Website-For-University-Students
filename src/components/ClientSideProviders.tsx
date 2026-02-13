"use client";

import React from 'react';
import { PWAInstallPromptHandler } from '@/components/pwa/PWAInstallPromptHandler';
import { RingtoneInitializer } from '@/hooks/useRingtoneInitializer';
import { CallingProvider } from '@/contexts/CallingContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { BackgroundCallHandler } from '@/components/calling/BackgroundCallHandler';
import { IncomingCallScreen } from '@/components/calling/IncomingCallScreen';
import { ActiveCallScreen } from '@/components/calling/ActiveCallScreen';

type Props = {
  children: React.ReactNode;
};

export default function ClientSideProviders({ children }: Props) {
  return (
    <>
      <PWAInstallPromptHandler />
      <RingtoneInitializer />
      <CallingProvider>
        <NotificationProvider>
          <BackgroundCallHandler />
          <IncomingCallScreen />
          <ActiveCallScreen />
          {children}
        </NotificationProvider>
      </CallingProvider>
    </>
  );
}
