import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/25",
        warning:
          "border-transparent bg-amber-400/20 text-amber-200 hover:bg-amber-400/30",
        error:
          "border-transparent bg-rose-500/20 text-rose-200 hover:bg-rose-500/30",
        info:
          "border-transparent bg-sky-500/20 text-sky-200 hover:bg-sky-500/30",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

function Badge({ className, variant, size, pulse, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), pulse ? 'animate-pulse' : '', className)}
      {...props}
    />
  )
}

// Status badge for ride/user statuses
type KnownStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'verified'
  | 'unverified'
  | 'scheduled'
  | 'suspended'
  | 'banned'
  | 'new'
  | 'read'
  | 'replied'
  | 'resolved'
  | 'archived'
  | 'investigating'
  | 'rejected';

type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

interface StatusBadgeProps extends BadgeProps {
  status?: KnownStatus | string;
}

const badgeSizeMap: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

function StatusBadge({ status, className, size = 'md', ...props }: StatusBadgeProps) {
  const statusVariants: Record<KnownStatus | 'fallback', string> = {
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    pending: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
    completed: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
    cancelled: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
    verified: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
    unverified: 'bg-orange-500/20 text-orange-200 border-orange-500/30',
    scheduled: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30',
    suspended: 'bg-amber-600/20 text-amber-100 border-amber-600/30',
    banned: 'bg-rose-600/25 text-rose-100 border-rose-600/35',
    new: 'bg-sky-500/20 text-sky-200 border-sky-500/30',
    read: 'bg-slate-500/20 text-slate-200 border-slate-500/30',
    replied: 'bg-teal-500/20 text-teal-200 border-teal-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
    archived: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/30',
    investigating: 'bg-amber-500/25 text-amber-100 border-amber-500/35',
    rejected: 'bg-rose-500/25 text-rose-100 border-rose-500/35',
    fallback: 'bg-muted text-foreground border-border/40',
  };
  const styles = status ? statusVariants[status as KnownStatus] ?? statusVariants.fallback : statusVariants.pending;
  const sizeClasses = badgeSizeMap[size] || badgeSizeMap.md;
  return (
    <div className={cn('inline-flex items-center rounded-full border font-semibold', sizeClasses, styles, className)} {...props} />
  );
}

export { Badge, badgeVariants, StatusBadge }
