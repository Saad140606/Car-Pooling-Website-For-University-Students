"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, Zap } from "lucide-react";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  type?: "empty" | "error" | "info" | "success";
  /**
   * Compatibility alias for existing usages expecting `variant` instead of `type`.
   */
  variant?: "empty" | "error" | "info" | "success";
}

/**
 * Animated empty state with configurable icon, title, and CTA
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, type = "empty", variant, ...props }, ref) => {
    const resolvedType = variant ?? type;
    const defaultIcons = {
      empty: <Zap className="h-16 w-16 text-muted-foreground" />,
      error: <AlertCircle className="h-16 w-16 text-destructive" />,
      info: <Info className="h-16 w-16 text-primary" />,
      success: <CheckCircle2 className="h-16 w-16 text-primary" />,
    };

    const typeColors = {
      empty: "text-muted-foreground",
      error: "text-destructive",
      info: "text-primary",
      success: "text-primary",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          "animate-scale-up",
          className
        )}
        {...props}
      >
        <div className="animate-float mb-4">
          {icon || defaultIcons[resolvedType]}
        </div>
        <h3 className={cn("text-xl font-semibold mb-2", typeColors[resolvedType])}>
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground mb-6 max-w-sm">
            {description}
          </p>
        )}
        {action && <div className="animate-bounce-in">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";
