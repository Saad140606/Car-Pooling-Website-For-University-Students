// src/lib/analyticsTypes.ts

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CORE ANALYTICS TYPES
// ============================================================================

export type UserRole = 'driver' | 'passenger' | 'both';

export interface TimeSeriesDataPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  value: number;
  label?: string;
}

export interface RideActivityDataPoint {
  day: string; // Mon, Tue, etc.
  hour: number; // 0-23
  value: number;
}

export interface RouteFrequency {
  from: string;
  to: string;
  count: number;
  lastUsed: Date;
}

// ============================================================================
// COMMON METRICS (Both Drivers & Passengers)
// ============================================================================

export interface CommonMetrics {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  pendingRides: number;
  averageRating: number | null;
  totalRatingsReceived: number;
  trustScore: number; // 0-100 calculated based on completion rate, ratings, etc.
  activeDaysOnPlatform: number;
  totalDistanceKm: number;
  totalTimeMinutes: number;
  memberSince: Date | null;
  lastActiveDate: Date | null;
}

// ============================================================================
// DRIVER-SPECIFIC METRICS
// ============================================================================

export interface DriverMetrics extends CommonMetrics {
  role: 'driver';
  totalPassengersServed: number;
  totalSeatsOffered: number;
  totalSeatsFilled: number;
  seatEfficiencyPercent: number; // (filled/offered) * 100
  rideAcceptanceRate: number; // accepted requests / total requests
  rideCompletionRate: number; // completed / (completed + cancelled)
  cancellationRate: number;
  peakRideHours: number[]; // Most common hours (0-23)
  mostCommonRoutes: RouteFrequency[];
  totalEarnings: number;
  averageEarningsPerRide: number;
  bestPerformingDays: string[]; // Day names with highest earnings
  earningsOverTime: TimeSeriesDataPoint[];
  ridesOverTime: TimeSeriesDataPoint[];
  weeklyActivity: TimeSeriesDataPoint[];
  rideActivityHeatmap: RideActivityDataPoint[];
}

// ============================================================================
// PASSENGER-SPECIFIC METRICS
// ============================================================================

export interface PassengerMetrics extends CommonMetrics {
  role: 'passenger';
  totalRidesTaken: number;
  ridesRequested: number;
  ridesConfirmed: number;
  requestToConfirmRate: number;
  cancellationRate: number;
  preferredPickupTimes: number[]; // Most common hours
  mostFrequentDestinations: RouteFrequency[];
  totalSpent: number;
  averageCostPerRide: number;
  spendingOverTime: TimeSeriesDataPoint[];
  ridesOverTime: TimeSeriesDataPoint[];
  weeklyActivity: TimeSeriesDataPoint[];
  rideActivityHeatmap: RideActivityDataPoint[];
}

// ============================================================================
// COMBINED ANALYTICS
// ============================================================================

export interface CombinedAnalytics {
  userRole: UserRole;
  driverMetrics: DriverMetrics | null;
  passengerMetrics: PassengerMetrics | null;
  insights: AnalyticsInsight[];
  rideStatusBreakdown: {
    label: string;
    value: number;
    color: string;
  }[];
}

// ============================================================================
// SMART INSIGHTS
// ============================================================================

export type InsightType = 
  | 'activity_pattern'
  | 'performance'
  | 'comparison'
  | 'trend'
  | 'suggestion'
  | 'achievement';

export interface AnalyticsInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  color: 'primary' | 'success' | 'warning' | 'info' | 'purple';
  value?: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

// ============================================================================
// RIDE HISTORY ENTRY
// ============================================================================

export interface RideHistoryEntry {
  id: string;
  date: Date;
  from: string;
  to: string;
  role: 'driver' | 'passenger';
  status: 'completed' | 'cancelled' | 'active' | 'pending';
  ratingGiven: number | null;
  ratingReceived: number | null;
  seats?: number;
  passengers?: number;
  fare: number;
  distanceKm?: number;
  durationMinutes?: number;
}

// ============================================================================
// FILTER & PAGINATION
// ============================================================================

export interface RideHistoryFilters {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  status: ('completed' | 'cancelled' | 'active' | 'pending')[];
  role: ('driver' | 'passenger')[];
  searchQuery: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================================================
// CHART DATA STRUCTURES
// ============================================================================

export interface LineChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

export interface BarChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

// ============================================================================
// ANALYTICS STATE
// ============================================================================

export interface AnalyticsState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  analytics: CombinedAnalytics | null;
  rideHistory: RideHistoryEntry[];
  filters: RideHistoryFilters;
  pagination: PaginationState;
}
