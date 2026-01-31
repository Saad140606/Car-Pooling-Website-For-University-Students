// src/components/VerificationBadge.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';

interface VerificationBadgeProps {
  /** Whether user is verified - if false, NOTHING is shown */
  verified?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show "Verified" text next to icon */
  showText?: boolean;
  /** Badge size: 'xs' | 'sm' | 'md' | 'lg' */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Enable glow animation effect */
  animate?: boolean;
  /** Inline mode - just icon, no badge wrapper */
  inline?: boolean;
}

/**
 * Premium Verified Badge Component
 * 
 * CRITICAL RULE: This badge ONLY appears for VERIFIED users.
 * If the user is NOT verified, this component returns NULL.
 * There is NO "unverified" state shown anywhere.
 * 
 * Usage:
 * <VerificationBadge verified={user.universityEmailVerified} />
 * <VerificationBadge verified={driver.isVerified} size="lg" showText />
 * <VerificationBadge verified={passenger.verified} inline /> // Just the icon
 */
export function VerificationBadge({ 
  verified, 
  className = '', 
  showText = false, 
  size = 'sm',
  animate = true,
  inline = false,
}: VerificationBadgeProps) {
  // CRITICAL: Return NULL if not verified - no badge shown for unverified users
  if (!verified) {
    return null;
  }

  // Size configurations
  const sizeConfig = {
    xs: { icon: 'h-2.5 w-2.5', text: 'text-[0.55rem]', padding: 'px-1 py-0.5', gap: 'gap-0.5' },
    sm: { icon: 'h-3 w-3', text: 'text-[0.65rem]', padding: 'px-1.5 py-0.5', gap: 'gap-1' },
    md: { icon: 'h-3.5 w-3.5', text: 'text-xs', padding: 'px-2 py-1', gap: 'gap-1' },
    lg: { icon: 'h-4 w-4', text: 'text-sm', padding: 'px-2.5 py-1', gap: 'gap-1.5' },
  };

  const { icon: iconSize, text: textSize, padding, gap } = sizeConfig[size];

  // Inline mode - just the verified checkmark icon with premium styling
  if (inline) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.span
              className={`inline-flex items-center justify-center ${className}`}
              initial={animate ? { scale: 0 } : undefined}
              animate={animate ? { scale: 1 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <BadgeCheck 
                className={`${iconSize} text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.5)]`}
                strokeWidth={2.5}
              />
            </motion.span>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-slate-800 border-emerald-500/30 text-white shadow-lg shadow-emerald-500/10"
          >
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-xs font-medium">Verified Student</span>
            </div>
            <p className="text-[0.65rem] text-slate-400 mt-0.5">University email confirmed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full badge mode with premium styling
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={animate ? { scale: 0, opacity: 0 } : undefined}
            animate={animate ? { scale: 1, opacity: 1 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Badge 
              variant="outline" 
              className={`
                ${className} 
                ${padding} 
                ${gap}
                ${textSize}
                bg-gradient-to-r from-emerald-500/15 via-emerald-400/10 to-teal-500/15
                text-emerald-400 
                border-emerald-500/40 
                hover:bg-emerald-500/25 
                hover:border-emerald-400/60
                hover:shadow-lg hover:shadow-emerald-500/20
                transition-all duration-200
                backdrop-blur-sm
                cursor-default
                select-none
              `}
            >
              <BadgeCheck 
                className={`${iconSize} drop-shadow-[0_0_2px_rgba(52,211,153,0.4)]`}
                strokeWidth={2.5}
              />
              {showText && (
                <span className="font-semibold tracking-wide">Verified</span>
              )}
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent 
          side="top"
          className="bg-slate-800 border-emerald-500/30 text-white shadow-lg shadow-emerald-500/10"
        >
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium">Verified Student</span>
          </div>
          <p className="text-[0.65rem] text-slate-400 mt-0.5">University email confirmed • Trusted user</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline Verified Badge - Compact version for use next to names
 * Shows only the icon with a subtle glow effect
 * 
 * Usage: <InlineVerifiedBadge verified={user.verified} />
 */
export function InlineVerifiedBadge({ verified, className = '' }: { verified?: boolean; className?: string }) {
  if (!verified) return null;
  
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${className}`}>
            <BadgeCheck 
              className="h-3.5 w-3.5 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]"
              strokeWidth={2.5}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top"
          className="bg-slate-800 border-emerald-500/30 text-white"
        >
          <span className="text-xs">✓ Verified Student</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
