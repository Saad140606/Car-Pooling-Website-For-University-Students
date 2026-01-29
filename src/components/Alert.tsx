'use client';

import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const AlertIcon = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const AlertColor = {
  info: {
    container: 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50',
    icon: 'text-blue-500',
    text: 'text-blue-900 dark:text-blue-100',
    action: 'text-blue-600 hover:text-blue-700 dark:hover:text-blue-200',
  },
  success: {
    container: 'bg-primary/10 border-primary/30 hover:border-primary/50',
    icon: 'text-primary',
    text: 'text-primary/90',
    action: 'text-primary hover:text-primary/80',
  },
  warning: {
    container: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50',
    icon: 'text-amber-500',
    text: 'text-amber-900 dark:text-amber-100',
    action: 'text-amber-600 hover:text-amber-700 dark:hover:text-amber-200',
  },
  error: {
    container: 'bg-destructive/10 border-destructive/30 hover:border-destructive/50',
    icon: 'text-destructive',
    text: 'text-destructive/90',
    action: 'text-destructive hover:text-destructive/80',
  },
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      type = 'info',
      title,
      message,
      description,
      icon: customIcon,
      action,
      dismissible = false,
      onDismiss,
      className,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true);

    const colors = AlertColor[type];
    const DefaultIcon = AlertIcon[type];

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 rounded-2xl border-2 p-4 backdrop-blur-sm transition-all duration-300 animate-slide-and-fade',
          colors.container,
          className
        )}
        role="alert"
      >
        {/* Icon */}
        <div className={cn('h-5 w-5 flex-shrink-0 mt-0.5', colors.icon)}>
          {customIcon || <DefaultIcon className="h-5 w-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1">
          {title && (
            <h4 className={cn('font-semibold text-sm', colors.text)}>
              {title}
            </h4>
          )}
          <p className={cn('text-sm leading-relaxed', colors.text)}>
            {message}
          </p>
          {description && (
            <p className={cn('text-xs opacity-80 mt-2', colors.text)}>
              {description}
            </p>
          )}

          {/* Action Button */}
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'mt-2 inline-block text-sm font-semibold transition-colors duration-200',
                colors.action
              )}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(
              'h-5 w-5 flex-shrink-0 mt-0.5 hover:scale-110 transition-transform duration-200',
              colors.icon
            )}
            aria-label="Dismiss alert"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

/**
 * Banner - A more prominent alert for page-level announcements
 */
interface BannerProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  fullWidth?: boolean;
}

const BannerColor = {
  info: 'bg-gradient-to-r from-blue-600/20 to-blue-400/10 border-blue-500/40',
  success: 'bg-gradient-to-r from-primary/20 to-primary/5 border-primary/40',
  warning: 'bg-gradient-to-r from-amber-600/20 to-amber-400/10 border-amber-500/40',
  error: 'bg-gradient-to-r from-destructive/20 to-destructive/5 border-destructive/40',
};

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  (
    {
      type = 'info',
      message,
      action,
      dismissible = false,
      onDismiss,
      fullWidth,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true);

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    if (!isVisible) return null;

    const DefaultIcon = AlertIcon[type];

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between gap-4 border-b-2 px-4 py-3 sm:px-6 backdrop-blur-sm animate-slide-down',
          BannerColor[type],
          !fullWidth && 'mx-4'
        )}
      >
        <div className="flex items-center gap-3">
          <DefaultIcon className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium text-foreground">{message}</p>
        </div>

        <div className="flex items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors duration-200"
            >
              {action.label}
            </button>
          )}

          {dismissible && (
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 p-1"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

Banner.displayName = 'Banner';
