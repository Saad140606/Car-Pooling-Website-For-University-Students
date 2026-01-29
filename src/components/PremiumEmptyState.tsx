'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PremiumEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'search' | 'bookings';
}

export function PremiumEmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: PremiumEmptyStateProps) {
  const getVisual = () => {
    switch (variant) {
      case 'search':
        return (
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        );
      case 'bookings':
        return (
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
        );
      default:
        return icon ? (
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            {icon}
          </div>
        ) : null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {getVisual()}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-xs mb-6 text-center">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium',
            'transition-all duration-200 ease-out',
            'hover:bg-primary/90 hover:shadow-lg hover:scale-105',
            'active:scale-95 active:shadow-md',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Skeleton for loading states
export function PremiumSkeleton({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-slate-800 rounded-lg',
        animated && 'animate-pulse',
        className
      )}
    />
  );
}

// Countdown timer
interface PremiumCountdownProps {
  targetDate: Date | number;
  onExpire?: () => void;
  format?: 'compact' | 'detailed';
}

export function PremiumCountdown({
  targetDate,
  onExpire,
  format = 'compact',
}: PremiumCountdownProps) {
  const [timeLeft, setTimeLeft] = React.useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft(null);
        onExpire?.();
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate, onExpire]);

  if (!timeLeft) {
    return <span className="text-red-400 font-semibold">Expired</span>;
  }

  if (format === 'compact') {
    if (timeLeft.days > 0) {
      return <span className="text-amber-400 font-semibold">{timeLeft.days}d {timeLeft.hours}h</span>;
    }
    if (timeLeft.hours > 0) {
      return <span className="text-amber-400 font-semibold">{timeLeft.hours}h {timeLeft.minutes}m</span>;
    }
    return <span className="text-orange-400 font-semibold">{timeLeft.minutes}m {timeLeft.seconds}s</span>;
  }

  return (
    <div className="flex gap-4 text-sm">
      {timeLeft.days > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</span>
          <span className="text-xs text-slate-400">Days</span>
        </div>
      )}
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-xs text-slate-400">Hours</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-xs text-slate-400">Minutes</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-xs text-slate-400">Seconds</span>
      </div>
    </div>
  );
}
