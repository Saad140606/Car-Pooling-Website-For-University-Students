"use client";

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  onComplete?: () => void;
};

/**
 * Professional OTP input component with auto-focus, error shake, and smooth transitions
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  error = false,
  onComplete,
}: OtpInputProps) {
  const inputsRef = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete();
    }
  }, [value, length, onComplete]);

  const handleChange = (index: number, val: string) => {
    const newVal = val.replace(/\D/g, '').slice(0, 1);
    const newCode = value.split('');
    newCode[index] = newVal;
    const updatedCode = newCode.join('');
    onChange(updatedCode.slice(0, length));

    if (newVal && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasteData);
    if (pasteData.length === length) {
      inputsRef.current[length - 1]?.blur();
    } else if (pasteData.length > 0) {
      inputsRef.current[Math.min(pasteData.length, length - 1)]?.focus();
    }
  };

  return (
    <div className={cn('flex items-center gap-2 sm:gap-3', error && 'animate-shake')}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            if (el) inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            'h-12 w-12 rounded-lg border-2 text-center text-xl font-semibold transition-all duration-200',
            error
              ? 'border-destructive/60 bg-destructive/10 text-destructive focus:border-destructive focus:ring-destructive/50'
              : 'border-input bg-background hover:border-primary/40 focus:border-primary/70 focus:ring-2 focus:ring-primary/30',
            disabled && 'cursor-not-allowed opacity-50',
            value[index] && 'bg-primary/10 border-primary/60 text-primary'
          )}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
