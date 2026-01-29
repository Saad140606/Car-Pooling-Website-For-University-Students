'use client';

import React from 'react';

interface NotificationBadgeProps {
  count: number;
  showZero?: boolean;
  dot?: boolean;
  className?: string;
  position?: 'top-right' | 'top-left' | 'inline';
}

export default function NotificationBadge({ 
  count, 
  showZero = false, 
  dot = false,
  className = '',
  position = 'top-right'
}: NotificationBadgeProps) {
  if (count === 0 && !showZero) return null;

  const baseClasses = 'bg-red-500 text-white font-bold flex items-center justify-center';
  
  const positionClasses = {
    'top-right': 'absolute -top-1 -right-1',
    'top-left': 'absolute -top-1 -left-1',
    'inline': ''
  };

  const sizeClasses = dot 
    ? 'h-2 w-2 rounded-full animate-pulse' 
    : count > 99 
      ? 'min-w-6 h-5 px-1.5 text-[10px] rounded-full'
      : count > 9
        ? 'h-5 w-5 text-[10px] rounded-full'
        : 'h-4 w-4 text-[9px] rounded-full';

  const displayCount = count > 99 ? '99+' : count;

  return (
    <span 
      className={`${baseClasses} ${positionClasses[position]} ${sizeClasses} ${className} shadow-lg ring-2 ring-white`}
      style={{ animation: 'fadeScaleIn 0.3s ease-out' }}
    >
      {!dot && displayCount}
      <style jsx>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.3);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </span>
  );
}
