'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, MessageSquare, Car, Phone, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PremiumNotificationProps {
  id: string;
  type: 'chat' | 'ride_request' | 'ride_accepted' | 'ride_confirmed' | 'ride_cancelled' | 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
  duration?: number;
  onClick?: () => void;
  onClose?: () => void;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  senderName?: string;
  senderAvatar?: string;
}

interface NotificationQueueItem extends PremiumNotificationProps {
  timestamp: number;
}

export const PremiumNotificationDisplay: React.FC<{
  notifications: NotificationQueueItem[];
  onClose: (id: string) => void;
}> = ({ notifications, onClose }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-5 h-5" />;
      case 'ride_request':
        return <Car className="w-5 h-5" />;
      case 'ride_accepted':
      case 'ride_confirmed':
        return <Check className="w-5 h-5" />;
      case 'ride_cancelled':
        return <AlertCircle className="w-5 h-5" />;
      case 'success':
        return <Check className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'chat':
        return 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400';
      case 'ride_request':
        return 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400';
      case 'ride_accepted':
      case 'ride_confirmed':
        return 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400';
      case 'ride_cancelled':
        return 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400';
      case 'success':
        return 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400';
      case 'error':
        return 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400';
      default:
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <AnimatePresence mode="popLayout">
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
        {notifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 400, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 400, y: -20 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 500,
              delay: index * 0.05,
            }}
            className="mb-3 pointer-events-auto"
          >
            <div
              className={cn(
                'relative w-[360px] max-w-[calc(100vw-2rem)] bg-gradient-to-br p-4 border rounded-xl backdrop-blur-md',
                'shadow-lg shadow-black/20 cursor-pointer hover:shadow-xl transition-all',
                getColor(notification.type)
              )}
              onClick={notification.onClick}
            >
              <div className="flex gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-current/20 flex items-center justify-center">
                  {notification.icon || getIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-white truncate">
                    {notification.title}
                  </h3>
                  <p className="text-xs text-white/70 line-clamp-2 mt-1">
                    {notification.message}
                  </p>

                  {/* Action Button */}
                  {notification.action && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.action?.onClick();
                      }}
                      className="mt-2 text-xs font-medium px-3 py-1 rounded-md bg-current/20 hover:bg-current/30 transition-colors text-white"
                    >
                      {notification.action.label}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(notification.id);
                  }}
                  className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: (notification.duration || 5) / 1000, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-0.5 bg-current/40 origin-left"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
};

/**
 * Hook to manage premium notifications
 */
export function usePremiumNotifications() {
  const [notifications, setNotifications] = useState<NotificationQueueItem[]>([]);

  const addNotification = (notification: PremiumNotificationProps) => {
    const id = notification.id || `notif-${Date.now()}-${Math.random()}`;
    const item: NotificationQueueItem = {
      ...notification,
      id,
      timestamp: Date.now(),
    };

    setNotifications(prev => [...prev, item]);

    // Auto-remove after duration
    const duration = notification.duration || 5000;
    const timeout = setTimeout(() => {
      removeNotification(id);
    }, duration);

    return () => clearTimeout(timeout);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  };
}
