"use client";

import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Car,
  User,
  RefreshCw,
  Download,
  Calendar,
  TrendingUp,
  Activity,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { computeUserAnalytics, buildRideHistory, fetchUserAnalyticsData } from '@/lib/analyticsService';
import {
  CombinedAnalytics,
  RideHistoryEntry,
  UserRole,
  DriverMetrics,
  PassengerMetrics,
} from '@/lib/analyticsTypes';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Import analytics components
import { DriverStatCards, PassengerStatCards } from '@/components/analytics/StatCards';
import {
  RidesLineChart,
  EarningsChart,
  WeeklyActivityChart,
  StatusPieChart,
  ActivityHeatmap,
  ProgressCircle,
} from '@/components/analytics/AnalyticsPremiumCharts';
import { RideHistoryTable } from '@/components/analytics/RideHistoryTable';
import { InsightsSection, QuickStatsBar } from '@/components/analytics/SmartInsights';

// ============================================================================
// ROLE TOGGLE TABS
// ============================================================================

interface RoleToggleProps {
  role: UserRole;
  activeView: 'driver' | 'passenger';
  onViewChange: (view: 'driver' | 'passenger') => void;
}

const RoleToggle = memo(function RoleToggle({
  role,
  activeView,
  onViewChange,
}: RoleToggleProps) {
  if (role !== 'both') return null;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1 bg-slate-900/50 border border-slate-800/50 rounded-lg w-full sm:w-auto">
      <button
        onClick={() => onViewChange('driver')}
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all w-full sm:w-auto',
          activeView === 'driver'
            ? 'bg-primary text-white shadow-lg shadow-primary/25'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        )}
      >
        <Car className="w-4 h-4" />
        Ride Provider View
      </button>
      <button
        onClick={() => onViewChange('passenger')}
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all w-full sm:w-auto',
          activeView === 'passenger'
            ? 'bg-primary text-white shadow-lg shadow-primary/25'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        )}
      >
        <User className="w-4 h-4" />
        Passenger View
      </button>
    </div>
  );
});

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}

const SectionHeader = memo(function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/15">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="sm:mt-0 mt-1">{action}</div>
    </div>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================

const AnalyticsSkeleton = memo(function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[350px] rounded-xl" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
});

// ============================================================================
// ERROR STATE
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

const ErrorState = memo(function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="p-4 rounded-full bg-red-500/10 mb-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Analytics</h3>
      <p className="text-sm text-slate-500 max-w-md mb-6">{message}</p>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
    </motion.div>
  );
});

// ============================================================================
// EMPTY STATE
// ============================================================================

const EmptyState = memo(function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="p-4 rounded-full bg-slate-800/50 mb-4">
        <BarChart3 className="w-10 h-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Analytics Data Yet</h3>
      <p className="text-sm text-slate-500 max-w-md">
        Start offering or booking rides to see your personal analytics, insights, and performance metrics.
      </p>
    </motion.div>
  );
});

// ============================================================================
// DRIVER ANALYTICS VIEW
// ============================================================================

interface DriverAnalyticsProps {
  metrics: DriverMetrics;
}

const DriverAnalyticsView = memo(function DriverAnalyticsView({ metrics }: DriverAnalyticsProps) {
  return (
    <div className="space-y-8">
      {/* Quick Stats Bar */}
      <QuickStatsBar
        stats={[
          { label: 'Active Days', value: metrics.activeDaysOnPlatform, icon: 'Calendar' },
          { label: 'Avg Earnings/Ride', value: `PKR ${metrics.averageEarningsPerRide}`, icon: 'Wallet' },
          { label: 'Completion Rate', value: `${metrics.rideCompletionRate}%`, icon: 'CheckCircle' },
          { label: 'Trust Score', value: `${metrics.trustScore}/100`, icon: 'Shield' },
        ]}
      />

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SectionHeader
          title="Performance Overview"
          subtitle="Your key ride provider metrics"
          icon={<Activity className="w-5 h-5 text-primary" />}
        />
        <DriverStatCards
          totalRides={metrics.totalRides}
          completedRides={metrics.completedRides}
          cancelledRides={metrics.cancelledRides}
          averageRating={metrics.averageRating}
          trustScore={metrics.trustScore}
          activeDays={metrics.activeDaysOnPlatform}
          totalDistanceKm={metrics.totalDistanceKm}
          totalTimeMinutes={metrics.totalTimeMinutes}
          totalPassengers={metrics.totalPassengersServed}
          seatEfficiency={metrics.seatEfficiencyPercent}
          totalEarnings={metrics.totalEarnings}
          completionRate={metrics.rideCompletionRate}
        />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RidesLineChart
          data={metrics.ridesOverTime}
          title="Rides Over Time"
          color="#3B82F6"
        />
        <EarningsChart
          data={metrics.earningsOverTime}
          title="Earnings Trend"
          isSpending={false}
        />
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WeeklyActivityChart
          data={metrics.weeklyActivity}
          title="Weekly Activity"
        />
        <div className="lg:col-span-2">
          <ActivityHeatmap
            data={metrics.rideActivityHeatmap}
            title="Activity Heatmap"
          />
        </div>
      </div>

      {/* Performance Circles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-6">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ProgressCircle
            percentage={metrics.seatEfficiencyPercent}
            label="Seat Efficiency"
            sublabel="Seats filled vs offered"
            color="#8B5CF6"
          />
          <ProgressCircle
            percentage={metrics.rideCompletionRate}
            label="Completion Rate"
            sublabel="Completed rides"
            color="#10B981"
          />
          <ProgressCircle
            percentage={metrics.rideAcceptanceRate}
            label="Acceptance Rate"
            sublabel="Accepted requests"
            color="#3B82F6"
          />
          <ProgressCircle
            percentage={100 - metrics.cancellationRate}
            label="Reliability"
            sublabel="Non-cancelled rides"
            color="#F59E0B"
          />
        </div>
      </motion.div>

      {/* Top Routes */}
      {metrics.mostCommonRoutes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Most Popular Routes</h3>
          <div className="space-y-3">
            {metrics.mostCommonRoutes.map((route, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">{route.from}</p>
                    <p className="text-xs text-slate-500">→ {route.to}</p>
                  </div>
                </div>
                <span className="text-sm text-slate-400">{route.count} rides</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
});

// ============================================================================
// PASSENGER ANALYTICS VIEW
// ============================================================================

interface PassengerAnalyticsProps {
  metrics: PassengerMetrics;
}

const PassengerAnalyticsView = memo(function PassengerAnalyticsView({ metrics }: PassengerAnalyticsProps) {
  return (
    <div className="space-y-8">
      {/* Quick Stats Bar */}
      <QuickStatsBar
        stats={[
          { label: 'Active Days', value: metrics.activeDaysOnPlatform, icon: 'Calendar' },
          { label: 'Avg Cost/Ride', value: `PKR ${metrics.averageCostPerRide}`, icon: 'CreditCard' },
          { label: 'Success Rate', value: `${metrics.requestToConfirmRate}%`, icon: 'CheckCircle' },
          { label: 'Trust Score', value: `${metrics.trustScore}/100`, icon: 'Shield' },
        ]}
      />

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SectionHeader
          title="Your Travel Summary"
          subtitle="Your key passenger metrics"
          icon={<Activity className="w-5 h-5 text-primary" />}
        />
        <PassengerStatCards
          totalRides={metrics.totalRides}
          completedRides={metrics.completedRides}
          cancelledRides={metrics.cancelledRides}
          averageRating={metrics.averageRating}
          trustScore={metrics.trustScore}
          activeDays={metrics.activeDaysOnPlatform}
          totalDistanceKm={metrics.totalDistanceKm}
          totalTimeMinutes={metrics.totalTimeMinutes}
          totalSpent={metrics.totalSpent}
          averageCostPerRide={metrics.averageCostPerRide}
          requestToConfirmRate={metrics.requestToConfirmRate}
          ridesRequested={metrics.ridesRequested}
        />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RidesLineChart
          data={metrics.ridesOverTime}
          title="Rides Over Time"
          color="#3B82F6"
        />
        <EarningsChart
          data={metrics.spendingOverTime}
          title="Spending Trend"
          isSpending={true}
        />
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WeeklyActivityChart
          data={metrics.weeklyActivity}
          title="Weekly Activity"
        />
        <div className="lg:col-span-2">
          <ActivityHeatmap
            data={metrics.rideActivityHeatmap}
            title="Activity Heatmap"
          />
        </div>
      </div>

      {/* Performance Circles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-6">Booking Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <ProgressCircle
            percentage={metrics.requestToConfirmRate}
            label="Booking Success"
            sublabel="Confirmed bookings"
            color="#10B981"
          />
          <ProgressCircle
            percentage={100 - metrics.cancellationRate}
            label="Reliability"
            sublabel="Non-cancelled rides"
            color="#3B82F6"
          />
          <ProgressCircle
            percentage={metrics.trustScore}
            label="Trust Score"
            sublabel="Overall reliability"
            color="#8B5CF6"
          />
        </div>
      </motion.div>
    </div>
  );
});

// ============================================================================
// MAIN ANALYTICS PAGE
// ============================================================================

export default function AnalyticsPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const [analytics, setAnalytics] = useState<CombinedAnalytics | null>(null);
  const [rideHistory, setRideHistory] = useState<RideHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'driver' | 'passenger'>('driver');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!firestore || !user || !userData?.university) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const analyticsData = await computeUserAnalytics(
        firestore,
        user.uid,
        userData.university
      );

      setAnalytics(analyticsData);

      // Build ride history
      const { driverRides, passengerBookings } = await fetchUserAnalyticsData(
        firestore,
        user.uid,
        userData.university
      );
      const history = buildRideHistory(driverRides, passengerBookings);
      setRideHistory(history);

      // Set default view based on role
      if (analyticsData.userRole === 'driver') {
        setActiveView('driver');
      } else if (analyticsData.userRole === 'passenger') {
        setActiveView('passenger');
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Analytics] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [firestore, user, userData?.university]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Determine current metrics based on view
  const currentMetrics = useMemo(() => {
    if (!analytics) return null;
    return activeView === 'driver' ? analytics.driverMetrics : analytics.passengerMetrics;
  }, [analytics, activeView]);

  // Loading state
  if (userLoading || isLoading) {
    return (
      <div className="min-h-[100dvh] p-4 md:p-6 lg:p-8 [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:pb-4">
        <div className="max-w-7xl mx-auto">
          <AnalyticsSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[100dvh] p-4 md:p-6 lg:p-8 [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:pb-4">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} onRetry={fetchAnalytics} />
        </div>
      </div>
    );
  }

  // Empty state
  if (!analytics || (!analytics.driverMetrics && !analytics.passengerMetrics)) {
    return (
      <div className="min-h-[100dvh] p-4 md:p-6 lg:p-8 [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:pb-4">
        <div className="max-w-7xl mx-auto">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] p-4 md:p-6 lg:p-8 overflow-x-hidden [@media(max-height:700px)]:p-3 [@media(max-height:700px)]:pb-4">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 [@media(max-height:700px)]:mb-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              Analytics Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {lastUpdated && (
                <>Last updated: {lastUpdated.toLocaleTimeString()}</>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Role Toggle */}
            <RoleToggle
              role={analytics.userRole}
              activeView={activeView}
              onViewChange={setActiveView}
            />

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={isLoading}
              className="gap-2 border-slate-700 hover:bg-slate-800 w-full sm:w-auto"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* University Badge */}
        {userData?.university && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 [@media(max-height:700px)]:mb-4"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary">
              {userData.university.toUpperCase()} University
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </span>
          </motion.div>
        )}

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8 [@media(max-height:700px)]:space-y-5"
          >
            {/* Role-specific analytics */}
            {activeView === 'driver' && analytics.driverMetrics && (
              <DriverAnalyticsView metrics={analytics.driverMetrics} />
            )}

            {activeView === 'passenger' && analytics.passengerMetrics && (
              <PassengerAnalyticsView metrics={analytics.passengerMetrics} />
            )}

            {/* Status Pie Chart */}
            {analytics.rideStatusBreakdown.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusPieChart
                  data={analytics.rideStatusBreakdown}
                  title="Ride Status Breakdown"
                />
                <div className="space-y-4">
                  <InsightsSection
                    insights={analytics.insights.slice(0, 3)}
                  />
                </div>
              </div>
            )}

            {/* Full Insights Section */}
            {analytics.insights.length > 3 && (
              <InsightsSection
                insights={analytics.insights}
              />
            )}

            {/* Ride History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <SectionHeader
                title="Ride History"
                subtitle="Your complete ride history with filters"
                icon={<Car className="w-5 h-5 text-primary" />}
              />
              <RideHistoryTable rides={rideHistory} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
