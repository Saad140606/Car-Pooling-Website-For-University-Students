'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, AlertCircle, MessageSquare, Car, Phone, Bell, 
  PhoneMissed, Clock, MapPin, Video, ShieldCheck, Star, 
  UserCheck, XCircle, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types/notification';

export interface PremiumNotificationProps {
  id: string;
  type: NotificationType | 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
  duration?: number; // 0 = persistent
  onClick?: () => void;
  onClose?: () => void;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  senderName?: string;
  senderAvatar?: string;
  senderVerified?: boolean;
  priority?: 'critical' | 'high' | 'normal' | 'low';
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
        return <UserCheck className="w-5 h-5" />;
      case 'ride_rejected':
        return <XCircle className="w-5 h-5" />;
      case 'ride_confirmed':
        return <Check className="w-5 h-5" />;
      case 'ride_cancelled':
        return <AlertCircle className="w-5 h-5" />;
      case 'ride_expired':
        return <Clock className="w-5 h-5" />;
      case 'ride_reminder':
        return <Bell className="w-5 h-5" />;
      case 'ride_started':
        return <MapPin className="w-5 h-5" />;
      case 'ride_completed':
        return <Sparkles className="w-5 h-5" />;
      case 'call_incoming':
        return <Phone className="w-5 h-5" />;
      case 'call_missed':
        return <PhoneMissed className="w-5 h-5" />;
      case 'call_ended':
        return <Phone className="w-5 h-5" />;
      case 'success':
        return <Check className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'verification':
        return <ShieldCheck className="w-5 h-5" />;
      case 'system':
        return <Star className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getColor = (type: string, priority?: string) => {
    // Critical priority gets special treatment
    if (priority === 'critical') {
      return 'from-amber-500/30 to-orange-600/30 border-amber-500/50 text-amber-400 ring-2 ring-amber-500/30';
    }
    
    switch (type) {
      case 'chat':
        return 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400';
      case 'ride_request':
        return 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400';
      case 'ride_accepted':
        return 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400';
      case 'ride_rejected':
        return 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400';
      case 'ride_confirmed':
        return 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400';
      case 'ride_cancelled':
        return 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400';
      case 'ride_expired':
        return 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400';
      case 'ride_reminder':
        return 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400';
      case 'ride_started':
        return 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30 text-cyan-400';
      case 'ride_completed':
        return 'from-teal-500/20 to-teal-600/20 border-teal-500/30 text-teal-400';
      case 'call_incoming':
        return 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400';
      case 'call_missed':
        return 'from-rose-500/20 to-rose-600/20 border-rose-500/30 text-rose-400';
      case 'call_ended':
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400';
      case 'success':
        return 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400';
      case 'error':
        return 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400';
      case 'verification':
        return 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400';
      default:
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400';
    }
  };

  // Sort notifications: critical first, then by timestamp
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <AnimatePresence mode="popLayout">
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
        {sortedNotifications.slice(0, 5).map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 400, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 400, y: -20, scale: 0.9 }}
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
                'relative w-[380px] max-w-[calc(100vw-2rem)] bg-gradient-to-br p-4 border rounded-xl backdrop-blur-xl',
                'shadow-lg shadow-black/30 cursor-pointer hover:shadow-xl transition-all',
                'hover:scale-[1.02]',
                getColor(notification.type, notification.priority)
              )}
              onClick={notification.onClick}
            >
              <div className="flex gap-3">
                {/* Avatar or Icon */}
                <div className="flex-shrink-0">
                  {notification.senderAvatar ? (
                    <div className="relative">
                      <img 
                        src={notification.senderAvatar} 
                        alt={notification.senderName || 'User'} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-current/30"
                      />
                      {notification.senderVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                          <ShieldCheck className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-current/20 flex items-center justify-center">
                      {notification.icon || getIcon(notification.type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-white truncate">
                      {notification.title}
                    </h3>
                    {notification.senderVerified && !notification.senderAvatar && (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-white/70 line-clamp-2 mt-1">
                    {notification.message}
                  </p>

                  {/* Sender name if different from title */}
                  {notification.senderName && !notification.title.includes(notification.senderName) && (
                    <p className="text-xs text-current/80 mt-1 font-medium">
                      From: {notification.senderName}
                    </p>
                  )}

                  {/* Action Button */}
                  {notification.action && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.action?.onClick();
                      }}
                      className="mt-2 text-xs font-medium px-3 py-1.5 rounded-md bg-current/20 hover:bg-current/30 transition-colors text-white"
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
                  className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar (only for non-persistent notifications) */}
              {(notification.duration ?? 5000) > 0 && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: (notification.duration || 5000) / 1000, ease: 'linear' }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-current/40 origin-left rounded-b-xl"
                />
              )}

              {/* Priority indicator for critical notifications */}
              {notification.priority === 'critical' && (
                <motion.div 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500"
                />
              )}
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

    // Auto-remove after duration (0 = persistent)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, duration);
      return () => clearTimeout(timeout);
    }
    
    return () => {};
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
