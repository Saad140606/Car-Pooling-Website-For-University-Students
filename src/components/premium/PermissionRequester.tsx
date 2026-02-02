'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Mic, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PermissionRequest {
  type: 'notifications' | 'microphone' | 'camera';
  status: 'pending' | 'granted' | 'denied' | 'not-determined';
}

export const PermissionRequester: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentPermission, setCurrentPermission] = useState<PermissionRequest | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const getSkipKey = (type: PermissionRequest['type']) => `permission_skip_${type}`;
  const isSkipped = (type: PermissionRequest['type']) => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(getSkipKey(type)) === '1';
  };
  const setSkipped = (type: PermissionRequest['type'], value: boolean) => {
    if (typeof window === 'undefined') return;
    const key = getSkipKey(type);
    if (value) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (typeof window === 'undefined') return;

    const needed: PermissionRequest[] = [];

    // Check notification permission
    if ('Notification' in window) {
      const status = Notification.permission as any;
      if (status === 'default') {
        if (isSkipped('notifications')) {
          needed.push({ type: 'notifications', status: 'denied' });
        } else {
          needed.push({ type: 'notifications', status: 'not-determined' });
        }
      } else {
        if (status === 'granted') {
          setSkipped('notifications', false);
        }
        needed.push({ type: 'notifications', status });
      }
    }

    // Check microphone permission
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const micStatus = await navigator.permissions.query({ name: 'microphone' as any });
        const micState = micStatus.state === 'prompt' ? 'not-determined' : micStatus.state;
        if (micState === 'not-determined' && isSkipped('microphone')) {
          needed.push({ type: 'microphone', status: 'denied' });
        } else {
          if (micState === 'granted') {
            setSkipped('microphone', false);
          }
          needed.push({ type: 'microphone', status: micState as any });
        }
      }
    } catch (error) {
      console.error('[Permission] Microphone check failed:', error);
    }

    // Check camera permission
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const cameraStatus = await navigator.permissions.query({ name: 'camera' as any });
        const cameraState = cameraStatus.state === 'prompt' ? 'not-determined' : cameraStatus.state;
        if (cameraState === 'not-determined' && isSkipped('camera')) {
          needed.push({ type: 'camera', status: 'denied' });
        } else {
          if (cameraState === 'granted') {
            setSkipped('camera', false);
          }
          needed.push({ type: 'camera', status: cameraState as any });
        }
      }
    } catch (error) {
      console.error('[Permission] Camera check failed:', error);
    }

    setPermissions(needed);

    // Show prompt for first pending permission
    const pending = needed.find(p => p.status === 'not-determined' || p.status === 'pending');
    if (pending) {
      setCurrentPermission(pending);
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
      setCurrentPermission(null);
    }
  };

  const handleRequestPermission = async () => {
    if (!currentPermission || isRequesting) return;
    setIsRequesting(true);

    try {
      switch (currentPermission.type) {
        case 'notifications':
          if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log('[Permission] Notification permission:', permission);
            setSkipped('notifications', false);
            updatePermission('notifications', permission as any);
          }
          break;

        case 'microphone':
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('[Permission] Microphone permission granted');
            setSkipped('microphone', false);
            updatePermission('microphone', 'granted');
          } catch (error: any) {
            console.error('[Permission] Microphone permission denied:', error);
            updatePermission('microphone', 'denied');
          }
          break;

        case 'camera':
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('[Permission] Camera permission granted');
            setSkipped('camera', false);
            updatePermission('camera', 'granted');
          } catch (error: any) {
            console.error('[Permission] Camera permission denied:', error);
            updatePermission('camera', 'denied');
          }
          break;
      }
    } catch (error) {
      console.error('[Permission] Request failed:', error);
    } finally {
      setIsRequesting(false);
    }

    // Re-check actual browser permissions after the request
    await checkPermissions();
  };

  const handleSkip = () => {
    if (currentPermission) {
      setSkipped(currentPermission.type, true);
      updatePermission(currentPermission.type, 'denied');
    }
    void checkPermissions();
  };

  const updatePermission = (type: string, status: string) => {
    setPermissions(prev =>
      prev.map(p => (p.type === type ? { ...p, status: status as any } : p))
    );
  };

  const getPermissionIcon = (type: string) => {
    switch (type) {
      case 'notifications':
        return <Bell className="w-5 h-5" />;
      case 'microphone':
        return <Mic className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getPermissionDescription = (type: string) => {
    switch (type) {
      case 'notifications':
        return {
          title: 'Enable Notifications',
          description: "Never miss important updates about your rides, messages, and calls. You'll get alerts even when the app is closed.",
        };
      case 'microphone':
        return {
          title: 'Allow Microphone Access',
          description: 'Enable crystal-clear audio for voice calls and messages. Your privacy is protected.',
        };
      case 'camera':
        return {
          title: 'Allow Camera Access',
          description: 'Enable video calling with other users. You have full control over when your camera is on.',
        };
      default:
        return { title: 'Permission Required', description: '' };
    }
  };

  if (!showPrompt || !currentPermission) {
    return null;
  }

  const { title, description } = getPermissionDescription(currentPermission.type);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700/50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-8 text-center border-b border-slate-700/30">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mb-4">
              {getPermissionIcon(currentPermission.type)}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
          </div>

          {/* Actions */}
          <div className="px-6 py-6 space-y-3">
            <Button
              onClick={handleRequestPermission}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium"
            >
              <Check className="w-4 h-4 mr-2" />
              Allow
            </Button>

            <Button
              onClick={handleSkip}
              variant="outline"
              className="w-full border-slate-600 hover:bg-slate-700/50"
            >
              <X className="w-4 h-4 mr-2" />
              Skip for Now
            </Button>
          </div>

          {/* Info */}
          <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700/30">
            <p className="text-xs text-slate-400 text-center">
              You can change permissions later in your device settings.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
