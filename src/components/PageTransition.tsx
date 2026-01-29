"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  animation?: "fade-slide" | "scale-up" | "slide-in-left" | "bounce-in";
  delay?: number;
  className?: string;
}

/**
 * Wraps page content with smooth entrance animation
 * Use this component to wrap entire page content for consistent page transitions
 */
export function PageTransition({
  children,
  animation = "fade-slide",
  delay = 0,
  className,
}: PageTransitionProps) {
  const animationClass = {
    "fade-slide": "animate-fade-slide",
    "scale-up": "animate-scale-up",
    "slide-in-left": "animate-slide-in-left",
    "bounce-in": "animate-bounce-in",
  }[animation];

  return (
    <div
      className={cn(animationClass, className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface StaggeredContainerProps {
  children: ReactNode;
  baseDelay?: number;
  staggerBy?: number;
  className?: string;
}

/**
 * Container that automatically staggers children animations
 * Each child gets incrementally delayed animation
 */
export function StaggeredContainer({
  children,
  baseDelay = 0,
  staggerBy = 80,
  className,
}: StaggeredContainerProps) {
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div className={className}>
      {childArray.map((child, idx) => (
        <div
          key={idx}
          style={{
            animationDelay: `${baseDelay + idx * staggerBy}ms`,
          }}
          className="animate-bounce-in"
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * Reveals content on scroll with smooth transitions
 * Used extensively throughout the site for scroll-triggered animations
 */
interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <div
      className={cn("reveal", className)}
      style={{
        "--reveal-delay": `${delay}ms`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Creates a parallax scroll effect for background layers
 */
interface ParallaxProps {
  children: ReactNode;
  depth?: number; // Higher = more parallax
  className?: string;
}

export function Parallax({ children, depth = 0.5, className }: ParallaxProps) {
  return (
    <div
      className={cn("transition-transform duration-300 ease-out", className)}
      style={{
        transform: `translateY(calc(var(--scroll, 0px) * ${depth}))`,
      }}
    >
      {children}
    </div>
  );
}
