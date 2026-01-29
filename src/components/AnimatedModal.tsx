"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ModalType = "default" | "success" | "warning" | "error" | "info";

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  type?: ModalType;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline";
    isLoading?: boolean;
  }>;
  closeButton?: boolean;
  className?: string;
}

const typeConfig: Record<ModalType, { icon: React.ReactNode; color: string }> =
  {
    default: { icon: null, color: "" },
    success: {
      icon: <CheckCircle2 className="h-6 w-6 text-primary" />,
      color: "border-primary/40 bg-primary/5",
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
      color: "border-yellow-500/40 bg-yellow-500/5",
    },
    error: {
      icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
      color: "border-destructive/40 bg-destructive/5",
    },
    info: {
      icon: <Info className="h-6 w-6 text-blue-500" />,
      color: "border-blue-500/40 bg-blue-500/5",
    },
  };

/**
 * Animated modal/dialog with smooth transitions, multiple variants, and action buttons
 */
export const AnimatedModal = forwardRef<HTMLDivElement, AnimatedModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      description,
      children,
      type = "default",
      actions = [],
      closeButton = true,
      className,
    },
    ref
  ) => {
    const config = typeConfig[type];

    if (!isOpen) return null;

    return (
      <div
        className={cn(
          "animate-fade-slide fixed inset-0 z-50 flex items-center justify-center p-4",
          "transition-opacity duration-300"
        )}
      >
        {/* Backdrop */}
        <div
          className="animate-fade-slide absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
          onClick={onClose}
        />

        {/* Modal Content */}
        <div
          ref={ref}
          className={cn(
            "animate-bounce-in relative z-10 w-full max-w-md",
            "glass-surface soft-shadow rounded-2xl border border-border",
            config.color,
            "overflow-hidden",
            className
          )}
        >
          {/* Header */}
          <div className="relative p-6 sm:p-8 pb-0">
            <div className="flex items-start gap-4">
              {config.icon && (
                <div className="flex-shrink-0 animate-scale-up">
                  {config.icon}
                </div>
              )}

              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
                {description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {description}
                  </p>
                )}
              </div>

              {closeButton && (
                <button
                  onClick={onClose}
                  className={cn(
                    "flex-shrink-0 p-1 hover:bg-muted rounded-lg transition-all",
                    "opacity-70 hover:opacity-100"
                  )}
                >
                  <X className="h-5 w-5 animate-rotate-in" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          {children && (
            <div className="px-6 sm:px-8 py-4 animate-scale-up">
              {children}
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div
              className={cn(
                "flex gap-3 p-6 sm:p-8 pt-4 border-t border-border/50",
                "animate-slide-and-fade",
                actions.length > 2 ? "flex-col" : ""
              )}
            >
              {actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.variant || "default"}
                  onClick={action.onClick}
                  disabled={action.isLoading}
                  className={cn(
                    "flex-1 rounded-lg",
                    action.variant === "outline" ? "" : "font-semibold"
                  )}
                >
                  {action.isLoading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent mr-2" />
                      Loading...
                    </>
                  ) : (
                    action.label
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

AnimatedModal.displayName = "AnimatedModal";

/**
 * Confirmation dialog with animated buttons
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
}) {
  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      type={isDangerous ? "warning" : "info"}
      actions={[
        {
          label: cancelText,
          onClick: onClose,
          variant: "outline",
        },
        {
          label: confirmText,
          onClick: onConfirm,
          variant: isDangerous ? "destructive" : "default",
          isLoading,
        },
      ]}
    />
  );
}
