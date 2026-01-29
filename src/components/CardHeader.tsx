'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Settings, MoreVertical } from 'lucide-react';

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  }>;
  className?: string;
  children?: ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  (
    {
      title,
      subtitle,
      description,
      icon,
      badge,
      action,
      actions,
      className,
      children,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4 p-6 border-b border-border/20 animate-slide-in-down',
          className
        )}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {icon && (
            <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mt-1">
              {icon}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-headline text-xl font-bold truncate">{title}</h2>
              {badge && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary whitespace-nowrap">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg',
                'font-medium text-sm transition-all duration-200',
                'hover:scale-105 active:scale-95',
                action.variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
                action.variant === 'secondary' && 'bg-secondary text-white hover:bg-secondary/90',
                action.variant === 'ghost' && 'bg-muted/20 text-foreground hover:bg-muted/40',
              )}
            >
              {action.label}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {actions && actions.length > 0 && (
            <div className="relative group">
              <button className="p-2 hover:bg-muted/20 rounded-lg transition-colors duration-200">
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-card border-2 border-border/30 rounded-xl shadow-lg z-10 overflow-hidden">
                {actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.onClick}
                    className="w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-muted/30 transition-colors duration-150 flex items-center gap-2 whitespace-nowrap"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

/**
 * Page Header - Full-width page header with background
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: ReactNode;
  backgroundGradient?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      title,
      subtitle,
      description,
      icon,
      backgroundGradient = true,
      action,
      children,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-border/20 p-8 animate-slide-in-down',
          backgroundGradient && 'bg-gradient-to-br from-primary/10 to-accent/5 backdrop-blur-sm',
          !backgroundGradient && 'bg-card/50 backdrop-blur-lg',
          className
        )}
      >
        {/* Background Decoration */}
        {backgroundGradient && (
          <>
            <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl opacity-50" aria-hidden />
            <div className="absolute -right-32 -bottom-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl opacity-30" aria-hidden />
          </>
        )}

        <div className="relative flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            {icon && (
              <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-2xl">
                {icon}
              </div>
            )}

            <div>
              <h1 className="font-headline text-3xl sm:text-4xl font-bold">{title}</h1>
              {subtitle && (
                <p className="text-lg text-muted-foreground font-medium mt-2">{subtitle}</p>
              )}
              {description && (
                <p className="text-base text-muted-foreground mt-3 max-w-2xl">{description}</p>
              )}
            </div>
          </div>

          {action && (
            <button
              onClick={action.onClick}
              className="flex-shrink-0 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              {action.label}
            </button>
          )}
        </div>

        {children}
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';

/**
 * Empty Page State - When no content is available
 */
interface EmptyPageStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

export const EmptyPageState = React.forwardRef<HTMLDivElement, EmptyPageStateProps>(
  (
    {
      icon,
      title,
      description,
      action,
      children,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 px-4 rounded-2xl border-2 border-border/20 bg-card/30 backdrop-blur-sm',
          className
        )}
      >
        {icon && (
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-4xl mb-6 animate-bounce-in">
            {icon}
          </div>
        )}

        <h2 className="font-headline text-2xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center text-muted-foreground max-w-md mb-6">{description}</p>

        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 animate-scale-up"
          >
            {action.label}
          </button>
        )}

        {children}
      </div>
    );
  }
);

EmptyPageState.displayName = 'EmptyPageState';
