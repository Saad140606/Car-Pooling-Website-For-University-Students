"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AnimatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
}

/**
 * Animated input with floating label, focus animations, and error/success states
 */
export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ className, label, error, success, icon, ...props }, ref) => {
    return (
      <div className="relative w-full group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-all group-focus-within:text-primary">
            {icon}
          </div>
        )}
        <Input
          ref={ref}
          className={cn(
            "input-focus transition-all duration-250",
            icon && "pl-10",
            error && "input-error-shake border-destructive/60 focus:border-destructive",
            success && "input-success border-primary/60 bg-primary/5",
            className
          )}
          {...props}
        />
        {label && (
          <label className="label-float absolute left-3 top-2.5 text-sm font-medium text-muted-foreground pointer-events-none origin-left">
            {label}
          </label>
        )}
        {error && (
          <p className="animate-bounce-in text-xs text-destructive mt-1">
            {error}
          </p>
        )}
        {success && (
          <p className="animate-scale-up text-xs text-primary mt-1">
            Looks good!
          </p>
        )}
      </div>
    );
  }
);

AnimatedInput.displayName = "AnimatedInput";
