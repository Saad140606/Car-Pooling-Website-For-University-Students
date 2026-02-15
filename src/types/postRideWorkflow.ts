/**
 * Post-Ride Workflow Type Definitions
 * 
 * Defines the structure for mandatory post-ride completion flow
 * This is a critical lifecycle system - types ensure data integrity
 */

/**
 * Post-ride status stored in Firestore ride document
 * Controls whether workflow must be shown
 */
export interface PostRideStatus {
  // Completion tracking
  passengerConfirmed: boolean;           // Passenger completed workflow
  driverConfirmed: boolean;              // Driver completed workflow
  pendingPassenger: boolean;             // Passenger workflow pending
  pendingDriver: boolean;                // Driver workflow pending
  
  // Workflow data
  passengerOutcome?: 'completed' | 'not_completed';     // Passenger's completion status
  driverOutcome?: 'show' | 'no_show';                   // Driver's passenger status
  passengerReason?: string;              // Why ride didn't complete (passenger)
  driverReasons?: Record<string, string>; // Why passengers didn't show (driver)
  
  // Ratings
  passengerRating?: number;              // 1-5 star rating of driver
  passengerReview?: string;              // Optional review
  driverRatings?: Record<string, number>; // Passenger ID -> rating
  driverReviews?: Record<string, string>; // Passenger ID -> review
  
  // Timestamps
  createdAt?: Date;                      // When status was created
  completedAt?: Date;                    // When workflow was completed
}

/**
 * Represents a pending post-ride workflow that needs completion
 */
export interface PendingPostRideWorkflow {
  rideId: string;
  userId: string;                        // Who needs to complete it
  userRole: 'passenger' | 'driver';      // Their role in ride
  rideData: {
    id: string;
    driverId: string;
    passengerId: string;
    departureTime: Date;
    departureLocation: string;
    destinationLocation: string;
    confirmedPassengers?: Array<{
      id: string;
      name: string;
      email: string;
    }>;
  };
  completedAt?: Date;                    // null if pending
  university: string;
}

/**
 * Pending workflows for current session
 */
export interface PostRideWorkflowState {
  // Current pending workflow to display
  currentWorkflow: PendingPostRideWorkflow | null;
  
  // All pending workflows for user
  pendingWorkflows: PendingPostRideWorkflow[];
  
  // Current step in workflow
  currentStep: 'outcome' | 'rating' | 'reason' | 'complete';
  
  // Form data (temporary)
  formData: {
    outcome?: 'completed' | 'not_completed' | 'show' | 'no_show';
    rating?: number;
    review?: string;
    reason?: string;
    passengerConfirmations?: Record<string, 'show' | 'no_show'>;
    passengerRatings?: Record<string, number>;
    passengerReviews?: Record<string, string>;
  };
  
  // Loading/error states
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

/**
 * Configuration for post-ride workflow timing
 */
export interface PostRideConfig {
  // Delay after departure before workflow triggers (in seconds)
  triggerDelaySeconds: number;
  
  // Max display per session (prevent spam)
  maxWorkflowsPerSession: number;
  
  // Retry attempts for failed submissions
  maxRetries: number;
  
  // How long to wait between retries (in seconds)
  retryDelaySeconds: number;
}

/**
 * Environment-specific configs
 */
export const POST_RIDE_CONFIGS = {
  development: {
    triggerDelaySeconds: 300,  // 5 minutes for testing
    maxWorkflowsPerSession: 10,
    maxRetries: 3,
    retryDelaySeconds: 5,
  },
  staging: {
    triggerDelaySeconds: 600,  // 10 minutes
    maxWorkflowsPerSession: 10,
    maxRetries: 3,
    retryDelaySeconds: 10,
  },
  production: {
    triggerDelaySeconds: 3600, // 60 minutes
    maxWorkflowsPerSession: 5,
    maxRetries: 5,
    retryDelaySeconds: 30,
  },
} as const;

/**
 * Get config for current environment
 */
export function getPostRideConfig(): PostRideConfig {
  const env = process.env.NODE_ENV as keyof typeof POST_RIDE_CONFIGS;
  return POST_RIDE_CONFIGS[env] || POST_RIDE_CONFIGS.production;
}
