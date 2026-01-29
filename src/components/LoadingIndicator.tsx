"use client";

import { cn } from "@/lib/utils";

interface LoadingIndicatorProps {
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "pulse" | "dots";
  className?: string;
  text?: string;
}

/**
 * Animated loading indicator with multiple style variants
 */
export function LoadingIndicator({
  size = "md",
  variant = "spinner",
  className,
  text,
}: LoadingIndicatorProps) {
  const sizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  if (variant === "dots") {
    return (
      <div className={cn("flex gap-1 items-center", className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full bg-primary animate-bounce",
              sizeMap[size]
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("animate-pulse-glow", sizeMap[size], className)}>
        <div className={cn("rounded-full bg-primary", sizeMap[size])} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("animate-spin", sizeMap[size])}>
        <div className={cn(
          "rounded-full border-2 border-primary/30 border-t-primary",
          sizeMap[size]
        )} />
      </div>
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

/**
 * Full-page loading overlay
 */
export function LoadingOverlay({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/40 backdrop-blur-sm",
        "animate-fade-slide",
        className
      )}
    >
      <div className="text-center space-y-4">
        <LoadingIndicator size="lg" />
        {message && (
          <p className="text-foreground font-medium">{message}</p>
        )}
      </div>
    </div>
  );
}
