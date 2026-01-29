'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Bell, MessageCircle, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

interface NotificationBadgeProps {
  count?: number;
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'warning';
  pulse?: boolean;
  animate?: boolean;
  className?: string;
}

const BadgeVariants = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-white',
  danger: 'bg-destructive text-white',
  success: 'bg-green-500 text-white',
  warning: 'bg-amber-500 text-white',
};

export const NotificationBadge = React.forwardRef<HTMLDivElement, NotificationBadgeProps>(
  (
    {
      count = 0,
      variant = 'primary',
      pulse = true,
      animate = true,
      className,
    },
    ref
  ) => {
    if (count === 0) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center',
          'h-5 w-5 min-w-[20px] px-1 rounded-full',
          'text-[11px] font-bold tabular-nums',
          BadgeVariants[variant],
          pulse && 'animate-pulse-glow',
          animate && 'animate-bounce-in',
          className
        )}
        title={`${count} new items`}
      >
        {count > 99 ? '99+' : count}
      </div>
    );
  }
);

NotificationBadge.displayName = 'NotificationBadge';

/**
 * Notification Item - Individual notification in a list
 */
interface NotificationItemProps {
  id: string;
  icon?: ReactNode;
  title: string;
  message: string;
  timestamp?: string;
  read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error' | 'message';
  avatar?: {
    src?: string;
    initials?: string;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: (id: string) => void;
  onRead?: (id: string) => void;
  className?: string;
}

const NotificationIcons = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  message: MessageCircle,
};

const NotificationColors = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-500',
    text: 'text-blue-900 dark:text-blue-100',
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: 'text-green-500',
    text: 'text-green-900 dark:text-green-100',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
    text: 'text-amber-900 dark:text-amber-100',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    icon: 'text-destructive',
    text: 'text-destructive/90',
  },
  message: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: 'text-primary',
    text: 'text-primary/90',
  },
};

export const NotificationItem = React.forwardRef<HTMLDivElement, NotificationItemProps>(
  (
    {
      id,
      icon: customIcon,
      title,
      message,
      timestamp,
      read = false,
      type = 'info',
      avatar,
      action,
      onDismiss,
      onRead,
      className,
    },
    ref
  ) => {
    const colors = NotificationColors[type];
    const DefaultIcon = NotificationIcons[type];

    const handleClick = () => {
      if (!read) {
        onRead?.(id);
      }
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={cn(
          'relative flex gap-3 rounded-xl border-2 p-4 transition-all duration-300 animate-slide-in-left cursor-pointer',
          colors.bg,
          colors.border,
          !read && 'bg-opacity-60 hover:bg-opacity-100',
          read && 'opacity-70 hover:opacity-100',
          className
        )}
      >
        {/* Unread Indicator */}
        {!read && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
        )}

        {/* Avatar or Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {avatar?.src ? (
            <img
              src={avatar.src}
              alt={avatar.initials}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : avatar?.initials ? (
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
              colors.bg,
              colors.text
            )}>
              {avatar.initials}
            </div>
          ) : (
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-lg', colors.icon)}>
              {customIcon || <DefaultIcon className="h-5 w-5" />}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className={cn('font-semibold text-sm', colors.text)}>
                {title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {message}
              </p>
            </div>
            {timestamp && (
              <p className="text-xs text-muted-foreground flex-shrink-0">
                {timestamp}
              </p>
            )}
          </div>

          {/* Action Button */}
          {action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={cn(
                'mt-2 text-xs font-semibold transition-colors duration-200',
                colors.icon,
                'hover:opacity-80'
              )}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(id);
            }}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors duration-200 p-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);

NotificationItem.displayName = 'NotificationItem';

/**
 * Notification Center - Grouped list of notifications
 */
interface NotificationCenterProps {
  notifications: NotificationItemProps[];
  title?: string;
  emptyMessage?: string;
  onClear?: () => void;
  onMarkAllRead?: () => void;
  className?: string;
}

export const NotificationCenter = React.forwardRef<HTMLDivElement, NotificationCenterProps>(
  (
    {
      notifications,
      title = 'Notifications',
      emptyMessage = 'No notifications',
      onClear,
      onMarkAllRead,
      className,
    },
    ref
  ) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border-2 border-border/30 bg-card/80 backdrop-blur-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/20 p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">{title}</h2>
            {unreadCount > 0 && (
              <NotificationBadge count={unreadCount} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {onMarkAllRead && unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-200"
              >
                Mark all read
              </button>
            )}
            {onClear && notifications.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2 p-4 max-h-96 overflow-y-auto scrollbar-custom">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            notifications.map((notification, idx) => (
              <NotificationItem
                key={notification.id}
                {...notification}
                className={`animate-slide-in-left ${notification.read && 'opacity-60'}`}
              />
            ))
          )}
        </div>
      </div>
    );
  }
);

NotificationCenter.displayName = 'NotificationCenter';
