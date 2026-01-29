"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeConfig: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  error: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
    icon: <AlertCircle className="h-5 w-5" />,
  },
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-600",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600",
    icon: <Info className="h-5 w-5" />,
  },
};

interface AnimatedToastProps {
  toast: Toast;
  onClose: () => void;
}

export function AnimatedToast({ toast, onClose }: AnimatedToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const config = typeConfig[toast.type];

  useEffect(() => {
    if (!toast.duration) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      className={cn(
        "animate-slide-in-down transition-all duration-300",
        isExiting && "animate-slide-out-up"
      )}
    >
      <div
        className={cn(
          "glass-surface soft-shadow border",
          config.bg,
          config.border,
          "p-4 rounded-lg flex items-start gap-3"
        )}
      >
        <div className={cn("flex-shrink-0 mt-0.5", config.text)}>
          {config.icon}
        </div>

        <div className="flex-1">
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {toast.description}
            </p>
          )}
        </div>

        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={cn(
              "text-xs font-semibold transition-colors",
              config.text,
              "hover:opacity-80"
            )}
          >
            {toast.action.label}
          </button>
        )}

        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
