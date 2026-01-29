"use client";

import { forwardRef } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: "lift" | "glow" | "grow" | "none";
  animation?: "bounce-in" | "scale-up" | "flip-in" | "slide-in-left" | "none";
  // Allow arbitrary numeric delays to match usage patterns
  delay?: number;
}

/**
 * Animated card with configurable hover effects and entrance animations
 */
export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    { className, hover = "lift", animation = "bounce-in", delay = 0, children, ...props },
    ref
  ) => {
    const hoverClass = {
      lift: "hover-card-lift",
      glow: "hover-glow",
      grow: "hover-grow",
      none: "",
    }[hover];

    const animationClass = {
      "bounce-in": "animate-bounce-in",
      "scale-up": "animate-scale-up",
      "flip-in": "animate-flip-in",
      "slide-in-left": "animate-slide-in-left",
      none: "",
    }[animation];

    const delayClass = delay > 0 ? `stagger-${delay}` : "";

    return (
      <Card
        ref={ref}
        className={cn(
          "glass-surface soft-shadow",
          hoverClass,
          animationClass,
          delayClass,
          "transition-all duration-300",
          className
        )}
        {...props}
      >
        {children}
      </Card>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";
