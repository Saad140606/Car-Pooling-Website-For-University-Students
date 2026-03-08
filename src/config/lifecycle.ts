/**
 * Ride Lifecycle Configuration
 * 
 * CRITICAL: Time-based completion window settings
 * 
 * This file centralizes all lifecycle timing configuration.
 * Update COMPLETION_DELAY_MINUTES to switch between testing and production modes.
 */

export const LIFECYCLE_CONFIG = {
  /**
   * Minutes after departure time before completion window opens
   * 
   * TESTING: 5 minutes (for rapid testing)
   * PRODUCTION: 60 minutes (for actual use)
   */
    COMPLETION_DELAY_MINUTES: 60,
  
  /**
   * How long the completion window stays open (in hours)
   */
  COMPLETION_WINDOW_DURATION_HOURS: 1,
  
  /**
   * How often the client-side monitor checks for status updates (in milliseconds)
   */
  CLIENT_CHECK_INTERVAL_MS: 15000, // 15 seconds
  
  /**
   * How often Cloud Functions scheduler runs (in minutes)
   * Note: This is defined in functions/src/rideLifecycleScheduler.ts
   */
  SCHEDULER_INTERVAL_MINUTES: {
    LOCK_RIDES: 1, // Every 1 minute
    COMPLETION_MANAGER: 2, // Every 2 minutes
  },
} as const;

/**
 * Helper to check if we're in production mode
 */
export const isProductionMode = () => {
  return LIFECYCLE_CONFIG.COMPLETION_DELAY_MINUTES >= 60;
};

/**
 * Get human-readable timing description
 */
export const getTimingDescription = () => {
  const delay = LIFECYCLE_CONFIG.COMPLETION_DELAY_MINUTES;
  if (delay < 60) {
    return `${delay} minute${delay > 1 ? 's' : ''} (TESTING MODE)`;
  }
  return `${delay / 60} hour${delay > 60 ? 's' : ''} (PRODUCTION MODE)`;
};
