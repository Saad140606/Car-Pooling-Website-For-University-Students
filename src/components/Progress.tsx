'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronRight } from 'lucide-react';

/**
 * Toggle Switch - On/Off toggle with animation
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SizeClasses = {
  sm: { toggle: 'w-10 h-6', circle: 'w-5 h-5' },
  md: { toggle: 'w-12 h-7', circle: 'w-6 h-6' },
  lg: { toggle: 'w-14 h-8', circle: 'w-7 h-7' },
};

export const ToggleSwitch = React.forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  (
    {
      checked,
      onChange,
      label,
      description,
      disabled,
      size = 'md',
      className,
    },
    ref
  ) => {
    const sizes = SizeClasses[size];

    return (
      <div className={cn('flex items-start gap-3', className)}>
        <button
          ref={ref}
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={cn(
            sizes.toggle,
            'relative inline-flex flex-shrink-0 rounded-full transition-all duration-300',
            'border-2 border-transparent',
            checked
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-muted/30 hover:bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background'
          )}
          role="switch"
          aria-checked={checked}
          aria-label={label}
        >
          {/* Animated Circle */}
          <span
            className={cn(
              sizes.circle,
              'absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-300 flex items-center justify-center',
              checked && 'translate-x-full'
            )}
          >
            {checked && <Check className="h-3 w-3 text-primary" />}
          </span>
        </button>

        {label && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground cursor-pointer">
              {label}
            </label>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToggleSwitch.displayName = 'ToggleSwitch';

/**
 * Step Indicator - Multi-step wizard progress
 */
interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  status?: 'pending' | 'active' | 'completed' | 'error';
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepChange?: (stepIndex: number) => void;
  clickable?: boolean;
  vertical?: boolean;
  className?: string;
}

export const StepIndicator = React.forwardRef<HTMLDivElement, StepIndicatorProps>(
  (
    {
      steps,
      currentStep,
      onStepChange,
      clickable = false,
      vertical = false,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          vertical ? 'space-y-4' : 'flex items-center gap-2 sm:gap-4',
          className
        )}
      >
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          const isError = step.status === 'error';

          return (
            <React.Fragment key={step.id}>
              {/* Step Item */}
              <button
                onClick={() => clickable && onStepChange?.(idx)}
                disabled={!clickable}
                className={cn(
                  'relative flex items-center gap-3 transition-all duration-300',
                  vertical ? 'flex-col text-left' : 'flex-shrink-0',
                  clickable && !vertical && 'cursor-pointer hover:scale-105',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background rounded-lg p-2 -m-2'
                )}
              >
                {/* Circle */}
                <div
                  className={cn(
                    'relative flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm flex-shrink-0 transition-all duration-300 animate-bounce-in',
                    isActive
                      ? 'bg-gradient-to-br from-primary to-accent text-white ring-4 ring-primary/30'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : isError
                      ? 'bg-destructive/20 text-destructive border-2 border-destructive/50'
                      : 'bg-muted/30 text-muted-foreground'
                  )}
                >
                  {isError ? (
                    <span>!</span>
                  ) : isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Label */}
                <div className={cn(!vertical && 'hidden sm:block')}>
                  <p className={cn(
                    'text-sm font-semibold transition-colors duration-200',
                    isActive ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted-foreground'
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  )}
                </div>
              </button>

              {/* Connector */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'transition-all duration-300',
                    vertical
                      ? 'h-8 w-1 mx-auto bg-gradient-to-b'
                      : 'flex-grow h-1 hidden sm:block',
                    isCompleted || idx < currentStep
                      ? 'from-primary/50 to-primary'
                      : 'from-muted/20 to-muted/10'
                  )}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

StepIndicator.displayName = 'StepIndicator';

/**
 * Progress Bar - Animated progress indicator
 */
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ProgressVariants = {
  default: 'from-primary to-accent',
  success: 'from-green-500 to-emerald-500',
  warning: 'from-amber-500 to-orange-500',
  error: 'from-destructive to-red-600',
  info: 'from-blue-500 to-cyan-500',
};

const ProgressSizes = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      label,
      showPercentage = true,
      animated = true,
      variant = 'default',
      size = 'md',
      className,
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {/* Label */}
        {label && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {showPercentage && (
              <span className="text-sm font-semibold text-primary">{Math.round(percentage)}%</span>
            )}
          </div>
        )}

        {/* Bar */}
        <div
          className={cn(
            'w-full rounded-full bg-muted/20 overflow-hidden',
            ProgressSizes[size]
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out rounded-full',
              'bg-gradient-to-r',
              ProgressVariants[variant],
              animated && 'shadow-lg shadow-primary/20'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

/**
 * Gauge - Circular progress indicator
 */
interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export const Gauge = React.forwardRef<SVGSVGElement, GaugeProps>(
  (
    {
      value,
      max = 100,
      label,
      size = 120,
      variant = 'default',
      className,
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const colorMap = {
      default: '#3F51B5',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    };

    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <svg
          ref={ref}
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#404557"
            strokeWidth="8"
            opacity="0.2"
          />
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorMap[variant]}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
          {/* Center Text */}
          <text
            x={size / 2}
            y={size / 2 + 5}
            textAnchor="middle"
            className="text-2xl font-bold fill-foreground"
          >
            {Math.round(percentage)}%
          </text>
        </svg>
        {label && (
          <p className="text-sm font-medium text-muted-foreground text-center">
            {label}
          </p>
        )}
      </div>
    );
  }
);

Gauge.displayName = 'Gauge';
