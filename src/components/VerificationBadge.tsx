// src/components/VerificationBadge.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerificationBadgeProps {
  verified?: boolean;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showUnverified?: boolean;
}

export function VerificationBadge({ verified, className = '', showText = true, size = 'sm', showUnverified = false }: VerificationBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const textSize = size === 'sm' ? 'text-[0.65rem]' : size === 'md' ? 'text-xs' : 'text-sm';

  if (!verified && !showUnverified) {
    return null;
  }
  
  if (verified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`${className} bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20 ${textSize} gap-1 px-1.5 py-0.5`}
            >
              <ShieldCheck className={iconSize} />
              {showText && 'Verified'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">University email verified</p>
            <p className="text-xs text-muted-foreground">Higher trust & acceptance rate</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${className} bg-amber-400/15 text-amber-700 border-amber-500/40 hover:bg-amber-400/25 ${textSize} gap-1 px-1.5 py-0.5`}
          >
            <ShieldQuestion className={iconSize} />
            {showText && 'Unverified'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">University email not verified</p>
          <p className="text-xs text-muted-foreground">Finish verification to increase trust</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
