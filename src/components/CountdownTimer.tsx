"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  format?: "mm:ss" | "ss" | "hms";
  className?: string;
  warningAt?: number; // Show warning color when time is below this
  variant?: "default" | "warning" | "danger";
}

/**
 * Animated countdown timer with color transitions for urgency
 */
export function CountdownTimer({
  seconds: initialSeconds,
  onComplete,
  format = "mm:ss",
  className,
  warningAt = 60,
  variant = "default",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isWarning, setIsWarning] = useState(initialSeconds <= warningAt);
  const [isDanger, setIsDanger] = useState(initialSeconds <= 10);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        const newTime = t - 1;
        setIsWarning(newTime <= warningAt);
        setIsDanger(newTime <= 10);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, warningAt, onComplete]);

  const formatTime = () => {
    if (format === "ss") return timeLeft.toString().padStart(2, "0");

    if (format === "hms") {
      const hours = Math.floor(timeLeft / 3600);
      const minutes = Math.floor((timeLeft % 3600) / 60);
      const secs = timeLeft % 60;
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    const minutes = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const displayVariant = isDanger ? "danger" : isWarning ? "warning" : variant;

  const colorClass = {
    default: "text-foreground",
    warning: "text-yellow-500 animate-subtle-bounce",
    danger: "text-destructive animate-pulse",
  }[displayVariant];

  return (
    <div
      className={cn(
        "font-mono font-bold transition-colors duration-300",
        colorClass,
        className
      )}
    >
      {formatTime()}
    </div>
  );
}

/**
 * Animated progress timer showing percentage and countdown
 */
export function ProgressTimer({
  seconds: initialSeconds,
  totalSeconds,
  onComplete,
}: {
  seconds: number;
  totalSeconds: number;
  onComplete?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  return (
    <div className="space-y-2">
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-linear"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">
        <CountdownTimer seconds={timeLeft} format="mm:ss" className="inline" />
      </p>
    </div>
  );
}
