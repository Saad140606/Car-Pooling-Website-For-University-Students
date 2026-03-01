'use client';

/**
 * Activity Indicator Dot Component
 * 
 * Displays a small animated dot indicating unread activity.
 * Used in navigation items (My Rides, My Bookings, Chat).
 * 
 * Features:
 * - Smooth fade in/out animations
 * - Responsive positioning
 * - Pulse animation for attention
 * - Customizable styling
 */

import React from 'react';

interface ActivityDotProps {
  /**
   * Whether to show the indicator dot
   */
  show: boolean;

  /**
   * Size of the dot in pixels (default: 8)
   */
  size?: number;

  /**
   * Color of the dot (default: 'bg-red-500')
   */
  color?: string;

  /**
   * Position of dot relative to container
   * Default: 'top-right'
   * Options: 'top-right', 'top-left', 'bottom-right', 'bottom-left'
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

  /**
   * Add pulse animation
   */
  pulse?: boolean;

  /**
   * Custom className for container
   */
  className?: string;
}

export function ActivityDot({
  show,
  size = 8,
  color = 'bg-red-500',
  position = 'top-right',
  pulse = true,
  className = '',
}: ActivityDotProps) {
  const positionClasses = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
  };

  if (!show) return null;

  // Use a consistent offset that places the dot slightly outside the
  // top-right (or other) corner so it's visible on dark backgrounds.
  // Use a small white ring for contrast and a higher z-index.
  return (
    <span
      className={`pointer-events-none absolute z-40 ${positionClasses[position]} ${color} rounded-full shadow-sm ring-2 ring-white/10 transition-opacity duration-200 ease-out ${
        pulse ? 'animate-pulse' : ''
      } ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: 'translate(50%, -50%)',
      }}
      aria-label="Unread activity indicator"
      role="status"
    />
  );
}

/**
 * Wrapper component for nav items with built-in activity dot
 */
interface ActivityNavItemProps {
  /**
   * Whether activity indicator should show
   */
  hasActivity: boolean;

  /**
   * The nav item content (icon, text, etc.)
   */
  children: React.ReactNode;

  /**
   * Additional className for the wrapper
   */
  className?: string;

  /**
   * Dot color override
   */
  dotColor?: string;
}

export function ActivityNavItem({
  hasActivity,
  children,
  className = '',
  dotColor = 'bg-red-500',
}: ActivityNavItemProps) {
  return (
    <div className={`relative inline-block w-full ${className}`}>
      <ActivityDot
        show={hasActivity}
        size={8}
        color={dotColor}
        position="top-right"
        pulse={true}
      />
      {children}
    </div>
  );
}

/**
 * Badge-style activity indicator for tab/section headers
 */
interface ActivityBadgeProps {
  /**
   * Whether to show the badge
   */
  show: boolean;

  /**
   * Badge text/count
   */
  label?: string | number;

  /**
   * Badge color
   */
  color?: string;

  /**
   * Badge text color
   */
  textColor?: string;
}

export function ActivityBadge({
  show,
  label,
  color = 'bg-red-500',
  textColor = 'text-white',
}: ActivityBadgeProps) {
  if (!show) return null;

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold ${color} ${textColor} rounded-full animate-pulse`}
    >
      {label || '●'}
    </span>
  );
}
