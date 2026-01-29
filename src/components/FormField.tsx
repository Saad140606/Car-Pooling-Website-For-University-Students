'use client';

import React, { useState, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface FormFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  error?: string;
  success?: boolean;
  disabled?: boolean;
  required?: boolean;
  icon?: ReactNode;
  hint?: string;
  showPasswordToggle?: boolean;
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  description?: string;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      value,
      onChange,
      onBlur,
      type = 'text',
      placeholder,
      error,
      success,
      disabled,
      required,
      icon,
      hint,
      showPasswordToggle,
      autoComplete,
      maxLength,
      minLength,
      pattern,
      description,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isShowingPassword, setIsShowingPassword] = useState(false);
    const id = React.useId();

    const inputType = showPasswordToggle && isShowingPassword ? 'text' : type;
    const hasValue = value.length > 0;
    const hasError = !!error;

    return (
      <div className="w-full space-y-2">
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium transition-colors duration-200',
              disabled ? 'text-muted-foreground/50' : 'text-foreground',
              hasError ? 'text-destructive' : isFocused ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </label>
        )}

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {icon && (
            <div className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none',
              isFocused ? 'text-primary scale-110' : hasError ? 'text-destructive' : 'text-muted-foreground',
              success && 'text-primary'
            )}>
              {icon}
            </div>
          )}

          {/* Input Field */}
          <input
            ref={ref}
            id={id}
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur?.();
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            maxLength={maxLength}
            minLength={minLength}
            pattern={pattern}
            required={required}
            className={cn(
              'relative w-full px-4 py-3 rounded-xl border-2 bg-card/50 text-foreground placeholder:text-muted-foreground/60',
              'transition-all duration-200 ease-out',
              'focus:outline-none focus:bg-card focus:ring-0',
              icon && 'pl-12',
              showPasswordToggle && 'pr-12',
              // Border states
              hasError
                ? 'border-destructive/50 focus:border-destructive hover:border-destructive/70'
                : isFocused
                ? 'border-primary/70 shadow-lg shadow-primary/10 bg-card'
                : success
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/40 hover:border-border/70 focus:border-primary/60',
              // Disabled state
              disabled && 'opacity-50 cursor-not-allowed hover:border-border/40',
              // Animation
              hasValue && 'animate-subtle-bounce'
            )}
          />

          {/* Password Toggle */}
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setIsShowingPassword(!isShowingPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors duration-200 p-1 hover:bg-primary/10 rounded-lg"
              tabIndex={-1}
              aria-label={isShowingPassword ? 'Hide password' : 'Show password'}
            >
              {isShowingPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Success Checkmark */}
          {success && !showPasswordToggle && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-scale-up">
              <Check className="h-5 w-5" />
            </div>
          )}

          {/* Error Icon */}
          {hasError && !showPasswordToggle && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Error Message or Hint */}
        {hasError && error && (
          <p className="text-sm text-destructive font-medium animate-input-error-shake flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </p>
        )}

        {hint && !hasError && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}

        {success && !error && (
          <p className="text-xs text-primary font-medium flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Looks good!
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
