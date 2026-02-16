"use client";

import React from 'react';
import { PWAInstallPromptHandler } from '@/components/pwa/PWAInstallPromptHandler';
import { RingtoneInitializer } from '@/hooks/useRingtoneInitializer';
import { CallingProvider } from '@/contexts/CallingContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ActivityIndicatorProvider } from '@/contexts/ActivityIndicatorContext';
import { PostRideProvider } from '@/contexts/PostRideWorkflowContext';
import { RideCompletionProvider } from '@/contexts/RideCompletionContext';
import { BackgroundCallHandler } from '@/components/calling/BackgroundCallHandler';
import { IncomingCallScreen } from '@/components/calling/IncomingCallScreen';
import { ActiveCallScreen } from '@/components/calling/ActiveCallScreen';
import { RideCompletionModal } from '@/components/RideCompletionModal';

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
          <ActivityIndicatorProvider>
            <PostRideProvider>
              <RideCompletionProvider>
                <BackgroundCallHandler />
                <IncomingCallScreen />
                <ActiveCallScreen />
                <RideCompletionModal />
                {children}
              </RideCompletionProvider>
            </PostRideProvider>
          </ActivityIndicatorProvider>
        </NotificationProvider>
      </CallingProvider>
    </>
  );
}
