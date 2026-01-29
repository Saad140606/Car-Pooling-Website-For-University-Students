"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

/**
 * Animated skeleton loader with shimmer effect for loading states
 */
export function Skeleton({ className, width, height, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-muted",
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
      {...props}
    />
  );
}

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

/**
 * Animated card skeleton loader with multiple lines
 */
export function SkeletonCard({ count = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      <Skeleton height={200} className="w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} height={16} className="w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Animated list skeleton loader with staggered items
 */
export function SkeletonList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-bounce-in",
            `stagger-${(i % 8) + 1}`
          )}
        >
          <Skeleton height={80} className="w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
