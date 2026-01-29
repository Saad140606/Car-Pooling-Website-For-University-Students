"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "primary" | "destructive" | "outline" | "secondary" | "success" | "warning" | "info" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xl";
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Animated button with ripple effect, press animations, and smooth transitions
 */
export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant = "default", size = "default", isLoading = false, children, asChild, icon, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        asChild={asChild}
        className={cn(
          "btn-press btn-ripple relative group",
          "transition-all duration-200",
          "hover:shadow-lg hover:shadow-primary/20",
          isLoading && "opacity-70 cursor-not-allowed",
          className
        )}
        disabled={props.disabled || isLoading}
        {...props}
      >
        <span className={cn("flex items-center gap-2", isLoading && "opacity-50")}
        >
          {isLoading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          )}
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </span>
      </Button>
    );
  }
);

AnimatedButton.displayName = "AnimatedButton";
