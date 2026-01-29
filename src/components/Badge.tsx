'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Clock, Users, MapPin, Zap } from 'lucide-react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
  animated?: boolean;
  pulse?: boolean;
  className?: string;
}

const BadgeVariants = {
  primary: 'bg-primary/20 text-primary border-primary/30 hover:border-primary/60',
  secondary: 'bg-secondary/20 text-secondary border-secondary/30 hover:border-secondary/60',
  success: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 hover:border-green-500/60',
  warning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:border-amber-500/60',
  error: 'bg-destructive/20 text-destructive border-destructive/30 hover:border-destructive/60',
  info: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:border-blue-500/60',
  accent: 'bg-accent/20 text-accent border-accent/30 hover:border-accent/60',
};

const BadgeSizes = {
  sm: 'px-2.5 py-1 text-xs font-semibold rounded-lg gap-1.5',
  md: 'px-3 py-1.5 text-sm font-semibold rounded-xl gap-2',
  lg: 'px-4 py-2 text-base font-semibold rounded-2xl gap-2.5',
};

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      children,
      animated,
      pulse,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center border-2 backdrop-blur-sm transition-all duration-300 whitespace-nowrap',
          BadgeVariants[variant],
          BadgeSizes[size],
          pulse && 'animate-pulse-glow',
          animated && 'animate-bounce-in',
          className
        )}
      >
        {icon && <div className="flex-shrink-0 flex items-center">{icon}</div>}
        <span>{children}</span>
      </div>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * Status Badge - Shows specific ride or booking statuses
 */
interface StatusBadgeProps {
  status:
    | 'active'
    | 'pending'
    | 'completed'
    | 'cancelled'
    | 'full'
    | 'ending-soon'
    | 'booked'
    | 'waiting'
    | 'accepted'
    | 'rejected';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const StatusConfig = {
  active: {
    label: 'Active',
    icon: Zap,
    variant: 'success' as const,
    pulse: true,
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'warning' as const,
    pulse: false,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    variant: 'success' as const,
    pulse: false,
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertCircle,
    variant: 'error' as const,
    pulse: false,
  },
  full: {
    label: 'Full',
    icon: Users,
    variant: 'error' as const,
    pulse: false,
  },
  'ending-soon': {
    label: 'Ending Soon',
    icon: Clock,
    variant: 'warning' as const,
    pulse: true,
  },
  booked: {
    label: 'Booked',
    icon: CheckCircle2,
    variant: 'success' as const,
    pulse: false,
  },
  waiting: {
    label: 'Waiting',
    icon: Clock,
    variant: 'info' as const,
    pulse: true,
  },
  accepted: {
    label: 'Accepted',
    icon: CheckCircle2,
    variant: 'success' as const,
    pulse: false,
  },
  rejected: {
    label: 'Rejected',
    icon: AlertCircle,
    variant: 'error' as const,
    pulse: false,
  },
};

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  (
    {
      status,
      size = 'md',
      animated,
      className,
    },
    ref
  ) => {
    const config = StatusConfig[status];
    const Icon = config.icon;

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        size={size}
        icon={<Icon className="h-4 w-4" />}
        pulse={config.pulse}
        animated={animated}
        className={className}
      >
        {config.label}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

/**
 * Stat Card - Shows ride statistics (seats, price, rating, etc.)
 */
interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
  className?: string;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      icon,
      label,
      value,
      subtext,
      highlight,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'p-3 rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm transition-all duration-300',
          'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover-card-lift',
          highlight && 'border-primary/50 bg-primary/5',
          className
        )}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0',
              highlight ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
            )}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <div className="flex items-baseline gap-1">
              <p className={cn(
                'text-lg font-bold tabular-nums',
                highlight ? 'text-primary' : 'text-foreground'
              )}>
                {value}
              </p>
              {subtext && (
                <span className="text-xs text-muted-foreground">{subtext}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

/**
 * Tag - Inline label for filtering and display
 */
interface TagProps {
  variant?: 'primary' | 'secondary' | 'muted' | 'accent';
  icon?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
}

const TagVariants = {
  primary: 'bg-primary/15 text-primary border-primary/20 hover:border-primary/50',
  secondary: 'bg-secondary/15 text-secondary border-secondary/20 hover:border-secondary/50',
  muted: 'bg-muted/15 text-muted-foreground border-muted/20 hover:border-muted/50',
  accent: 'bg-accent/15 text-accent border-accent/20 hover:border-accent/50',
};

export const Tag = React.forwardRef<HTMLDivElement, TagProps>(
  (
    {
      variant = 'primary',
      icon,
      children,
      onRemove,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-xs font-medium transition-all duration-200',
          TagVariants[variant],
          className
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="ml-1 text-current hover:opacity-70 transition-opacity duration-200"
            aria-label={`Remove ${children}`}
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);

Tag.displayName = 'Tag';
