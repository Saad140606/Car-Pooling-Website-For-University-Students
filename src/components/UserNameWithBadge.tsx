'use client';

import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';

interface UserNameWithBadgeProps {
  /** Full name of the user */
  name: string;
  /** Whether user is verified (both email AND ID verified) */
  verified?: boolean;
  /** CSS class names for the container */
  className?: string;
  /** Show truncate on long names */
  truncate?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Enable animation on badge appearance */
  animate?: boolean;
}

/**
 * GOD-LEVEL COMPONENT: UserNameWithBadge
 * 
 * Displays a username with inline verification badge.
 * This is a PREMIUM UI element that feels like a core identity marker.
 * 
 * Features:
 * - Perfect alignment between name and badge
 * - Smooth entrance animation
 * - Subtle glow effect on verified badge
 * - Responsive sizing
 * - Zero layout shift
 * - Premium hover states
 * 
 * Usage:
 * <UserNameWithBadge name="John Doe" verified={user.isVerified} />
 * <UserNameWithBadge name="Jane Smith" verified={true} size="lg" />
 * <UserNameWithBadge name="Student" truncate />
 */
export function UserNameWithBadge({
  name,
  verified = false,
  className = '',
  truncate = true,
  size = 'md',
  animate = true,
}: UserNameWithBadgeProps) {
  // Size configurations - perfectly calibrated for visual harmony
  const sizeConfig = {
    sm: {
      nameClass: 'text-sm',
      badgeSize: 'h-3.5 w-3.5',
      gap: 'gap-1.5',
      containerClass: 'leading-none',
    },
    md: {
      nameClass: 'text-base',
      badgeSize: 'h-4 w-4',
      gap: 'gap-2',
      containerClass: 'leading-snug',
    },
    lg: {
      nameClass: 'text-lg',
      badgeSize: 'h-5 w-5',
      gap: 'gap-2.5',
      containerClass: 'leading-snug',
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      className={`
        flex items-center ${config.gap} ${config.containerClass}
        ${className}
      `}
    >
      {/* Username */}
      <span
        className={`
          ${config.nameClass}
          font-semibold
          text-foreground
          ${truncate ? 'truncate' : ''}
          transition-colors duration-200
          hover:text-primary/80
        `}
      >
        {name}
      </span>

      {/* Verified Badge - Only shows if verified */}
      {verified && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                className="flex-shrink-0"
                initial={animate ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
                animate={animate ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 25,
                  delay: 0.05,
                }}
              >
                <div
                  className={`
                    inline-flex items-center justify-center
                    transition-all duration-200
                    hover:scale-110
                  `}
                >
                  <BadgeCheck
                    className={`
                      ${config.badgeSize}
                      text-emerald-400
                      drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]
                      hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]
                      transition-all duration-200
                    `}
                    strokeWidth={2.5}
                  />
                </div>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="
                bg-gradient-to-r from-slate-800 to-slate-700
                border border-emerald-500/40
                text-white
                shadow-lg shadow-emerald-500/10
                backdrop-blur-sm
              "
            >
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
                <div>
                  <p className="text-xs font-semibold">Verified Student</p>
                  <p className="text-[0.65rem] text-slate-400 mt-0.5">University email + ID verified</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default UserNameWithBadge;
