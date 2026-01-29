'use client';

import { useEffect } from 'react';
import { initializeRingtones } from '@/lib/ringtoneManager';

/**
 * Hook to initialize ringtones on app load
 * Should be called once in a top-level component or layout
 */
export function useRingtoneInitializer() {
  useEffect(() => {
    initializeRingtones();
  }, []);
}

/**
 * Component wrapper for ringtone initialization
 */
export const RingtoneInitializer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  useRingtoneInitializer();
  return children;
};
