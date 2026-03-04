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
  DollarSign,
  Wallet,
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
import { useActionFeedback } from '@/hooks/useActionFeedback';

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

// Import new post-ride analytics components
import DriverEarningsCard from '@/components/analytics/DriverEarningsCard';
import PassengerSpendingCard from '@/components/analytics/PassengerSpendingCard';

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
          'flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-all w-full sm:w-auto',
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
          'flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-all w-full sm:w-auto',
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6 min-w-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/15">
          {icon}
        </div>
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="mt-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
});

// ============================================================================
// LOADING SKELETON
// ============================================================================

const AnalyticsSkeleton = memo(function AnalyticsSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 sm:h-8 w-36 sm:w-48" />
          <Skeleton className="h-3 sm:h-4 w-48 sm:w-64" />
        </div>
        <Skeleton className="h-9 sm:h-10 w-24 sm:w-32" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-28 sm:h-32 rounded-xl" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Skeleton className="h-64 sm:h-[350px] rounded-xl" />
        <Skeleton className="h-64 sm:h-[350px] rounded-xl" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-80 sm:h-[400px] rounded-xl" />
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
      className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4"
    >
      <div className="p-3 sm:p-4 rounded-full bg-red-500/10 mb-3 sm:mb-4">
        <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Failed to Load Analytics</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-4 sm:mb-6 px-4">{message}</p>
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
      className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4"
    >
      <div className="p-3 sm:p-4 rounded-full bg-slate-800/50 mb-3 sm:mb-4">
        <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-white mb-2">No Analytics Data Yet</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-md px-4">
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
    <div className="space-y-5 sm:space-y-8 min-w-0 overflow-x-hidden">
      {/* Post-Ride Earnings & Ratings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <SectionHeader
          title="Earnings & Ratings"
          subtitle="Real earnings from completed rides"
          icon={<DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
        />
        <div className="min-w-0 overflow-x-hidden">
          <DriverEarningsCard />
        </div>
      </motion.div>

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
          icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
        />
        <DriverStatCards
          totalRides={metrics.totalRides}
          completedRides={metrics.completedRides}
          cancelledRides={metrics.cancelledRides}
          pendingRides={metrics.pendingRides}
          cancellationRate={metrics.cancellationRate}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
        className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 sm:p-6"
      >
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-6">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
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
            percentage={Math.max(0, Math.min(100, metrics.cancellationRate))}
            label="Cancellation Rate"
            sublabel="Cancelled rides"
            color="#EF4444"
          />
        </div>
      </motion.div>

      {/* Top Routes */}
      {metrics.mostCommonRoutes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 sm:p-6"
        >
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Most Popular Routes</h3>
          <div className="space-y-2 sm:space-y-3">
            {metrics.mostCommonRoutes.map((route, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-800/30 rounded-lg"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold flex-shrink-0">
                    #{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-white font-medium truncate">{route.from}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">→ {route.to}</p>
                  </div>
                </div>
                <span className="text-xs sm:text-sm text-slate-400 ml-2 flex-shrink-0">{route.count} rides</span>
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
    <div className="space-y-5 sm:space-y-8 min-w-0 overflow-x-hidden">
      {/* Post-Ride Spending Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <SectionHeader
          title="Spending Analytics"
          subtitle="Track your ride expenses"
          icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
        />
        <div className="min-w-0 overflow-x-hidden">
          <PassengerSpendingCard />
        </div>
      </motion.div>

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
          icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
        />
        <PassengerStatCards
          totalRides={metrics.totalRides}
          completedRides={metrics.completedRides}
          cancelledRides={metrics.cancelledRides}
          pendingRides={metrics.pendingRides}
          completionRate={metrics.rideCompletionRate}
          cancellationRate={metrics.cancellationRate}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
        className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 sm:p-6"
      >
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-6">Booking Performance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <ProgressCircle
            percentage={metrics.rideCompletionRate}
            label="Completion Rate"
            sublabel="Completed rides"
            color="#10B981"
          />
          <ProgressCircle
            percentage={Math.max(0, Math.min(100, metrics.cancellationRate))}
            label="Cancellation Rate"
            sublabel="Cancelled rides"
            color="#EF4444"
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
  const actionFeedback = useActionFeedback();

  const [analytics, setAnalytics] = useState<CombinedAnalytics | null>(null);
  const [rideHistory, setRideHistory] = useState<RideHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'driver' | 'passenger'>('driver');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const analyticsCacheKey = useMemo(() => {
    if (!user?.uid || !userData?.university) return null;
    return `analytics_cache:${user.uid}:${String(userData.university).trim().toLowerCase()}`;
  }, [user?.uid, userData?.university]);

  const prerequisitesReady = Boolean(firestore && user?.uid && userData?.university);

  useEffect(() => {
    if (!analyticsCacheKey || typeof window === 'undefined') return;

    try {
      const raw = window.sessionStorage.getItem(analyticsCacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        analytics?: CombinedAnalytics;
        rideHistory?: RideHistoryEntry[];
        activeView?: 'driver' | 'passenger';
        lastUpdated?: string;
      };

      if (parsed?.analytics) {
        setAnalytics(parsed.analytics);
      }
      if (Array.isArray(parsed?.rideHistory)) {
        setRideHistory(parsed.rideHistory);
      }
      if (parsed?.activeView === 'driver' || parsed?.activeView === 'passenger') {
        setActiveView(parsed.activeView);
      }
      if (parsed?.lastUpdated) {
        const parsedDate = new Date(parsed.lastUpdated);
        if (!Number.isNaN(parsedDate.getTime())) {
          setLastUpdated(parsedDate);
        }
      }

      if (parsed?.analytics) {
        setIsLoading(false);
      }
    } catch (error) {
      console.debug('[Analytics] Failed to hydrate cache:', error);
    }
  }, [analyticsCacheKey]);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!firestore || !user || !userData?.university) {
      return;
    }

    actionFeedback.start('Please wait, analytics page is opening...', 'Opening Analytics...');
    setIsLoading(true);
    setError(null);

    try {
      const buildThirtyDaySeries = (
        entries: Array<{ date?: string; value?: number }>
      ) => {
        const byDate = new Map<string, number>();
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
          const day = new Date(today);
          day.setDate(day.getDate() - i);
          const key = day.toISOString().split('T')[0];
          byDate.set(key, 0);
        }

        entries.forEach((entry) => {
          if (!entry?.date) return;
          const date = new Date(entry.date);
          if (Number.isNaN(date.getTime())) return;
          const key = date.toISOString().split('T')[0];
          if (!byDate.has(key)) return;
          byDate.set(key, (byDate.get(key) || 0) + Number(entry.value || 0));
        });

        return Array.from(byDate.entries()).map(([date, value]) => ({
          date,
          value,
          label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));
      };

      const analyticsData = await computeUserAnalytics(
        firestore,
        user.uid,
        userData.university
      );

      let passengerApiAnalytics: any = null;
      let driverApiAnalytics: any = null;

      // Sync summary metrics with post-ride analytics APIs (best-effort only)
      try {
        let token = '';
        try {
          token = await user.getIdToken(true);
        } catch (tokenError) {
          const tokenCode = String((tokenError as any)?.code || '');
          if (tokenCode === 'auth/network-request-failed') {
            console.warn('[Analytics] Token refresh failed due to network; using cached token if available');
            token = await user.getIdToken(false);
          } else {
            throw tokenError;
          }
        }

        if (token) {
          const authHeaders = { Authorization: `Bearer ${token}` };
          await Promise.all([
            fetch(`/api/analytics/passenger?university=${encodeURIComponent(userData.university)}`, { headers: authHeaders })
              .then(async (response) => {
                if (!response.ok) return;
                const data = await response.json();
                if (data?.success) passengerApiAnalytics = data.analytics;
              })
              .catch(() => undefined),
            fetch(`/api/analytics/driver?university=${encodeURIComponent(userData.university)}`, { headers: authHeaders })
              .then(async (response) => {
                if (!response.ok) return;
                const data = await response.json();
                if (data?.success) driverApiAnalytics = data.analytics;
              })
              .catch(() => undefined),
          ]);
        }
      } catch (syncError) {
        console.warn('[Analytics] API metric sync skipped:', syncError);
      }

      if (analyticsData.passengerMetrics && passengerApiAnalytics) {
        analyticsData.passengerMetrics.totalSpent = Number(passengerApiAnalytics.totalSpent || analyticsData.passengerMetrics.totalSpent || 0);
        analyticsData.passengerMetrics.averageCostPerRide = Math.round(Number(passengerApiAnalytics.averageSpentPerRide || analyticsData.passengerMetrics.averageCostPerRide || 0));
        analyticsData.passengerMetrics.totalRidesTaken = Number(passengerApiAnalytics.totalRidesTaken || analyticsData.passengerMetrics.totalRidesTaken || 0);
        analyticsData.passengerMetrics.averageRating = Number(passengerApiAnalytics.averageRating || analyticsData.passengerMetrics.averageRating || 0);

        const spendingEntries = Array.isArray(passengerApiAnalytics.spendingPerRide)
          ? passengerApiAnalytics.spendingPerRide.map((item: any) => ({ date: item?.date, value: Number(item?.amount || 0) }))
          : [];
        if (spendingEntries.length > 0) {
          analyticsData.passengerMetrics.spendingOverTime = buildThirtyDaySeries(spendingEntries);
        }
      }

      if (analyticsData.driverMetrics && driverApiAnalytics) {
        analyticsData.driverMetrics.totalEarnings = Number(driverApiAnalytics.totalEarnings || analyticsData.driverMetrics.totalEarnings || 0);
        analyticsData.driverMetrics.averageEarningsPerRide = analyticsData.driverMetrics.completedRides > 0
          ? Math.round(analyticsData.driverMetrics.totalEarnings / analyticsData.driverMetrics.completedRides)
          : analyticsData.driverMetrics.averageEarningsPerRide;
        analyticsData.driverMetrics.totalPassengersServed = Number(driverApiAnalytics.totalPassengersServed || analyticsData.driverMetrics.totalPassengersServed || 0);
        analyticsData.driverMetrics.averageRating = Number(driverApiAnalytics.averageRating || analyticsData.driverMetrics.averageRating || 0);

        const earningEntries = Array.isArray(driverApiAnalytics.earningsPerRide)
          ? driverApiAnalytics.earningsPerRide.map((item: any) => ({ date: item?.date, value: Number(item?.earnings || 0) }))
          : [];
        if (earningEntries.length > 0) {
          analyticsData.driverMetrics.earningsOverTime = buildThirtyDaySeries(earningEntries);
        }
      }

      setAnalytics(analyticsData);

      // Build ride history
      const { driverRides, passengerBookings, passengerRequests } = await fetchUserAnalyticsData(
        firestore,
        user.uid,
        userData.university
      );
      const history = buildRideHistory(driverRides, passengerBookings, passengerRequests);
      setRideHistory(history);

      // Set default view based on role
      if (analyticsData.userRole === 'driver') {
        setActiveView('driver');
      } else if (analyticsData.userRole === 'passenger') {
        setActiveView('passenger');
      }

      setLastUpdated(new Date());

      if (analyticsCacheKey && typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          analyticsCacheKey,
          JSON.stringify({
            analytics: analyticsData,
            rideHistory: history,
            activeView: analyticsData.userRole === 'passenger' ? 'passenger' : activeView,
            lastUpdated: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      console.error('[Analytics] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
      actionFeedback.clear();
    }
  }, [firestore, user, userData?.university, analyticsCacheKey, activeView, actionFeedback]);

  useEffect(() => {
    return () => {
      actionFeedback.clear();
    };
  }, [actionFeedback]);

  // Initial fetch
  useEffect(() => {
    if (!prerequisitesReady) return;
    fetchAnalytics();
  }, [fetchAnalytics, prerequisitesReady]);

  // Determine current metrics based on view
  const currentMetrics = useMemo(() => {
    if (!analytics) return null;
    return activeView === 'driver' ? analytics.driverMetrics : analytics.passengerMetrics;
  }, [analytics, activeView]);

  // Loading state
  if (userLoading || (!prerequisitesReady && !analytics) || isLoading) {
    return (
      <div className="min-h-[100dvh] p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <AnalyticsSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[100dvh] p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} onRetry={fetchAnalytics} />
        </div>
      </div>
    );
  }

  // Empty state
  if (!analytics || (!analytics.driverMetrics && !analytics.passengerMetrics)) {
    return (
      <div className="min-h-[100dvh] p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] px-2 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 pb-28 sm:pb-10 overflow-x-hidden touch-pan-y">
      <div className="max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 sm:mb-6 min-w-0"
        >
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary" />
              Analytics Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
              {lastUpdated && (
                <>Last updated: {lastUpdated.toLocaleTimeString()}</>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
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
              className="gap-2 border-slate-700 hover:bg-slate-800 w-full sm:w-auto h-11 sm:h-9"
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
            className="mb-4 sm:mb-6"
          >
            <span className="inline-flex items-center gap-2 px-2.5 py-1.5 sm:px-3 bg-primary/10 border border-primary/20 rounded-full text-xs sm:text-sm font-medium text-primary">
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
            className="space-y-5 sm:space-y-8"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
                <StatusPieChart
                  data={analytics.rideStatusBreakdown}
                  title="Ride Status Breakdown"
                />
                <div className="space-y-4 min-w-0">
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
              <div className="min-w-0 overflow-x-auto">
                <RideHistoryTable rides={rideHistory} />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
