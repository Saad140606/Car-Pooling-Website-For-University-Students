'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart,
  RadialBarChart, RadialBar
} from 'recharts';
import {
  Users, Car, Wallet, TrendingUp, TrendingDown, Activity, CheckCircle,
  XCircle, Clock, UserCheck, UserX, Banknote, Calendar, Filter,
  ChevronDown, RefreshCw, Building2, GraduationCap, ArrowUpRight,
  ArrowDownRight, Percent, Target, Award, Zap, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface UniversityStats {
  // Users
  totalUsers: number;
  totalDrivers: number;
  totalPassengers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisMonth: number;
  verifiedUsers: number;

  // Rides
  totalRides: number;
  activeRides: number;
  completedRides: number;
  cancelledRides: number;
  pendingRides: number;
  confirmedRides: number;
  ridesThisWeek: number;
  ridesThisMonth: number;

  // Passengers / Requests
  totalRequests: number;
  confirmedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  totalSeatedPassengers: number;

  // Financial
  totalDriverEarnings: number;
  totalPassengerSpending: number;
  averageEarningsPerRide: number;
  averageRidePrice: number;
  highestRidePrice: number;
  lowestRidePrice: number;

  // Time-series data
  ridesOverTime: { date: string; rides: number; completed: number; cancelled: number }[];
  earningsOverTime: { date: string; earnings: number }[];
  usersOverTime: { date: string; users: number }[];
  rideStatusDistribution: { name: string; value: number; color: string }[];
  requestStatusDistribution: { name: string; value: number; color: string }[];
}

interface TimeRange {
  label: string;
  value: '7d' | '30d' | '90d' | 'all';
  days: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIME_RANGES: TimeRange[] = [
  { label: 'Last 7 Days', value: '7d', days: 7 },
  { label: 'Last 30 Days', value: '30d', days: 30 },
  { label: 'Last 90 Days', value: '90d', days: 90 },
  { label: 'All Time', value: 'all', days: 365 * 10 },
];

const COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

const STATUS_COLORS = {
  active: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
  pending: '#f59e0b',
  confirmed: '#8b5cf6',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `PKR ${amount.toLocaleString()}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDateKey(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isWithinDays(timestamp: any, days: number): boolean {
  if (!timestamp) return false;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  color: string;
  delay?: number;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-5 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl hover:shadow-primary/10"
    >
      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
      
      {/* Decorative circle */}
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${trend.isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {trend.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        <p className="text-sm text-slate-400 font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{typeof value === 'number' ? formatNumber(value) : value}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

// ============================================================================
// CHART CARD COMPONENT
// ============================================================================

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

function ChartCard({ title, subtitle, children, delay = 0, className = '' }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className={`rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-6 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl p-3 shadow-xl">
      <p className="text-sm font-semibold text-white mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-white">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// UNIVERSITY DASHBOARD COMPONENT
// ============================================================================

interface UniversityDashboardProps {
  universityId: string;
  universityName: string;
  timeRange: TimeRange;
}

function UniversityDashboard({ universityId, universityName, timeRange }: UniversityDashboardProps) {
  const firestore = useFirestore();
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data for this university
  useEffect(() => {
    if (!firestore || !universityId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize date maps for time series
        const ridesMap: { [key: string]: { rides: number; completed: number; cancelled: number } } = {};
        const earningsMap: { [key: string]: number } = {};
        const usersMap: { [key: string]: number } = {};

        // Generate date keys for the time range
        for (let i = timeRange.days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const key = getDateKey(date);
          ridesMap[key] = { rides: 0, completed: 0, cancelled: 0 };
          earningsMap[key] = 0;
          usersMap[key] = 0;
        }

        // ========== FETCH USERS ==========
        const usersRef = collection(firestore, `universities/${universityId}/users`);
        const usersSnap = await getDocs(usersRef);
        
        let totalUsers = 0;
        let totalDrivers = 0;
        let totalPassengers = 0;
        let activeUsers = 0;
        let inactiveUsers = 0;
        let newUsersThisMonth = 0;
        let verifiedUsers = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        usersSnap.forEach(doc => {
          const data = doc.data();
          totalUsers++;
          
          // Count drivers (users who have created rides)
          if (data.hasCreatedRide || data.isDriver || data.ridesOffered > 0) {
            totalDrivers++;
          }
          
          // Count active users (logged in within 30 days)
          const lastLogin = data.lastLoginAt?.toDate?.() || data.lastActive?.toDate?.();
          if (lastLogin && lastLogin >= thirtyDaysAgo) {
            activeUsers++;
          } else {
            inactiveUsers++;
          }
          
          // Count new users this month
          const createdAt = data.createdAt?.toDate?.();
          if (createdAt && createdAt >= thirtyDaysAgo) {
            newUsersThisMonth++;
            const key = getDateKey(createdAt);
            if (usersMap[key] !== undefined) usersMap[key]++;
          }
          
          // Count verified users
          if (data.emailVerified || data.isVerified || data.verified) {
            verifiedUsers++;
          }
        });

        totalPassengers = totalUsers; // All users can be passengers

        // ========== FETCH RIDES ==========
        const ridesRef = collection(firestore, `universities/${universityId}/rides`);
        const ridesSnap = await getDocs(ridesRef);
        
        let totalRides = 0;
        let activeRides = 0;
        let completedRides = 0;
        let cancelledRides = 0;
        let pendingRides = 0;
        let confirmedRides = 0;
        let ridesThisWeek = 0;
        let ridesThisMonth = 0;
        let totalDriverEarnings = 0;
        let totalPrices: number[] = [];
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        ridesSnap.forEach(doc => {
          const data = doc.data();
          totalRides++;
          
          const status = (data.status || '').toLowerCase();
          const price = data.price || data.fare || 0;
          totalPrices.push(price);
          
          // Count by status
          if (status === 'active' || status === 'open') activeRides++;
          else if (status === 'completed') {
            completedRides++;
            totalDriverEarnings += price;
          }
          else if (status === 'cancelled') cancelledRides++;
          else if (status === 'pending') pendingRides++;
          else if (status === 'confirmed') {
            confirmedRides++;
          }
          
          // Time-based counts
          const createdAt = data.createdAt?.toDate?.() || data.departureTime?.toDate?.();
          if (createdAt) {
            if (createdAt >= sevenDaysAgo) ridesThisWeek++;
            if (createdAt >= thirtyDaysAgo) ridesThisMonth++;
            
            const key = getDateKey(createdAt);
            if (ridesMap[key]) {
              ridesMap[key].rides++;
              if (status === 'completed') ridesMap[key].completed++;
              if (status === 'cancelled') ridesMap[key].cancelled++;
            }
            
            if (status === 'completed' && earningsMap[key] !== undefined) {
              earningsMap[key] += price;
            }
          }
        });

        // ========== FETCH REQUESTS/BOOKINGS ==========
        const bookingsRef = collection(firestore, `universities/${universityId}/bookings`);
        const bookingsSnap = await getDocs(bookingsRef);
        
        let totalRequests = 0;
        let confirmedRequests = 0;
        let pendingRequests = 0;
        let rejectedRequests = 0;
        let totalSeatedPassengers = 0;
        let totalPassengerSpending = 0;

        bookingsSnap.forEach(doc => {
          const data = doc.data();
          totalRequests++;
          
          const status = (data.status || '').toUpperCase();
          const price = data.price || 0;
          
          if (status === 'CONFIRMED' || status === 'ACCEPTED') {
            confirmedRequests++;
            totalSeatedPassengers++;
            totalPassengerSpending += price;
          } else if (status === 'PENDING') {
            pendingRequests++;
          } else if (status === 'REJECTED' || status === 'DECLINED' || status === 'CANCELLED') {
            rejectedRequests++;
          }
        });

        // Also check for requests in ride subcollections
        for (const rideDoc of ridesSnap.docs) {
          try {
            const requestsRef = collection(firestore, `universities/${universityId}/rides/${rideDoc.id}/requests`);
            const requestsSnap = await getDocs(requestsRef);
            
            requestsSnap.forEach(reqDoc => {
              const data = reqDoc.data();
              totalRequests++;
              
              const status = (data.status || '').toUpperCase();
              
              if (status === 'CONFIRMED' || status === 'ACCEPTED') {
                confirmedRequests++;
                totalSeatedPassengers++;
              } else if (status === 'PENDING') {
                pendingRequests++;
              } else if (status === 'REJECTED' || status === 'DECLINED') {
                rejectedRequests++;
              }
            });
          } catch (e) {
            // Skip if can't read requests
          }
        }

        // Calculate averages
        const averageEarningsPerRide = completedRides > 0 ? totalDriverEarnings / completedRides : 0;
        const averageRidePrice = totalPrices.length > 0 ? totalPrices.reduce((a, b) => a + b, 0) / totalPrices.length : 0;
        const highestRidePrice = totalPrices.length > 0 ? Math.max(...totalPrices) : 0;
        const lowestRidePrice = totalPrices.length > 0 ? Math.min(...totalPrices.filter(p => p > 0)) : 0;

        // Build time series data
        const ridesOverTime = Object.entries(ridesMap).map(([date, data]) => ({
          date,
          rides: data.rides,
          completed: data.completed,
          cancelled: data.cancelled,
        }));

        const earningsOverTime = Object.entries(earningsMap).map(([date, earnings]) => ({
          date,
          earnings,
        }));

        const usersOverTime = Object.entries(usersMap).map(([date, users]) => ({
          date,
          users,
        }));

        // Build distribution data
        const rideStatusDistribution = [
          { name: 'Active', value: activeRides, color: STATUS_COLORS.active },
          { name: 'Completed', value: completedRides, color: STATUS_COLORS.completed },
          { name: 'Cancelled', value: cancelledRides, color: STATUS_COLORS.cancelled },
          { name: 'Pending', value: pendingRides, color: STATUS_COLORS.pending },
          { name: 'Confirmed', value: confirmedRides, color: STATUS_COLORS.confirmed },
        ].filter(item => item.value > 0);

        const requestStatusDistribution = [
          { name: 'Confirmed', value: confirmedRequests, color: COLORS.success },
          { name: 'Pending', value: pendingRequests, color: COLORS.warning },
          { name: 'Rejected', value: rejectedRequests, color: COLORS.danger },
        ].filter(item => item.value > 0);

        setStats({
          totalUsers,
          totalDrivers,
          totalPassengers,
          activeUsers,
          inactiveUsers,
          newUsersThisMonth,
          verifiedUsers,
          totalRides,
          activeRides,
          completedRides,
          cancelledRides,
          pendingRides,
          confirmedRides,
          ridesThisWeek,
          ridesThisMonth,
          totalRequests,
          confirmedRequests,
          pendingRequests,
          rejectedRequests,
          totalSeatedPassengers,
          totalDriverEarnings,
          totalPassengerSpending,
          averageEarningsPerRide,
          averageRidePrice,
          highestRidePrice,
          lowestRidePrice,
          ridesOverTime,
          earningsOverTime,
          usersOverTime,
          rideStatusDistribution,
          requestStatusDistribution,
        });

      } catch (err: any) {
        console.error('Error fetching university data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [firestore, universityId, timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  // Calculate percentages and trends
  const completionRate = stats.totalRides > 0 ? (stats.completedRides / stats.totalRides) * 100 : 0;
  const cancellationRate = stats.totalRides > 0 ? (stats.cancelledRides / stats.totalRides) * 100 : 0;
  const confirmationRate = stats.totalRequests > 0 ? (stats.confirmedRequests / stats.totalRequests) * 100 : 0;
  const userActivityRate = stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* University Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 pb-4 border-b border-slate-700/50"
      >
        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <GraduationCap className="h-7 w-7 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{universityName}</h2>
          <p className="text-slate-400 text-sm">Complete analytics and insights</p>
        </div>
      </motion.div>

      {/* ========== USER STATS ========== */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          User Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            subtitle={`${stats.newUsersThisMonth} new this month`}
            icon={Users}
            trend={{ value: 12, isPositive: true }}
            color="from-blue-600 to-blue-400"
            delay={0}
          />
          <StatCard
            title="Total Ride Providers"
            value={stats.totalDrivers}
            subtitle={`${formatPercent((stats.totalDrivers / stats.totalUsers) * 100)} of users`}
            icon={Car}
            color="from-purple-600 to-purple-400"
            delay={1}
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            subtitle={`${formatPercent(userActivityRate)} activity rate`}
            icon={UserCheck}
            trend={{ value: 8, isPositive: true }}
            color="from-green-600 to-green-400"
            delay={2}
          />
          <StatCard
            title="Verified Users"
            value={stats.verifiedUsers}
            subtitle={`${formatPercent((stats.verifiedUsers / stats.totalUsers) * 100)} verified`}
            icon={Award}
            color="from-amber-600 to-amber-400"
            delay={3}
          />
        </div>
      </section>

      {/* ========== RIDE STATS ========== */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          Ride Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Rides"
            value={stats.totalRides}
            subtitle={`${stats.ridesThisMonth} this month`}
            icon={Car}
            trend={{ value: 15, isPositive: true }}
            color="from-indigo-600 to-indigo-400"
            delay={0}
          />
          <StatCard
            title="Completed Rides"
            value={stats.completedRides}
            subtitle={`${formatPercent(completionRate)} completion rate`}
            icon={CheckCircle}
            trend={{ value: completionRate, isPositive: completionRate > 50 }}
            color="from-emerald-600 to-emerald-400"
            delay={1}
          />
          <StatCard
            title="Active Rides"
            value={stats.activeRides}
            subtitle={`${stats.ridesThisWeek} created this week`}
            icon={Activity}
            color="from-cyan-600 to-cyan-400"
            delay={2}
          />
          <StatCard
            title="Cancelled Rides"
            value={stats.cancelledRides}
            subtitle={`${formatPercent(cancellationRate)} cancellation rate`}
            icon={XCircle}
            trend={{ value: cancellationRate, isPositive: false }}
            color="from-red-600 to-red-400"
            delay={3}
          />
        </div>
      </section>

      {/* ========== PASSENGER / REQUEST STATS ========== */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Passenger & Request Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Requests"
            value={stats.totalRequests}
            subtitle="All time requests"
            icon={Zap}
            color="from-violet-600 to-violet-400"
            delay={0}
          />
          <StatCard
            title="Confirmed Requests"
            value={stats.confirmedRequests}
            subtitle={`${formatPercent(confirmationRate)} confirmation rate`}
            icon={CheckCircle}
            trend={{ value: confirmationRate, isPositive: confirmationRate > 50 }}
            color="from-teal-600 to-teal-400"
            delay={1}
          />
          <StatCard
            title="Pending Requests"
            value={stats.pendingRequests}
            subtitle="Awaiting response"
            icon={Clock}
            color="from-orange-600 to-orange-400"
            delay={2}
          />
          <StatCard
            title="Seated Passengers"
            value={stats.totalSeatedPassengers}
            subtitle="Successfully booked"
            icon={UserCheck}
            color="from-lime-600 to-lime-400"
            delay={3}
          />
        </div>
      </section>

      {/* ========== FINANCIAL STATS ========== */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Financial Analytics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Earnings"
            value={formatCurrency(stats.totalDriverEarnings)}
            subtitle="Ride provider earnings"
            icon={Banknote}
            trend={{ value: 18, isPositive: true }}
            color="from-green-600 to-emerald-400"
            delay={0}
          />
          <StatCard
            title="Total Spending"
            value={formatCurrency(stats.totalPassengerSpending)}
            subtitle="Passenger spending"
            icon={Wallet}
            color="from-blue-600 to-cyan-400"
            delay={1}
          />
          <StatCard
            title="Avg Earnings/Ride"
            value={formatCurrency(Math.round(stats.averageEarningsPerRide))}
            subtitle="Per completed ride"
            icon={TrendingUp}
            color="from-purple-600 to-pink-400"
            delay={2}
          />
          <StatCard
            title="Avg Ride Price"
            value={formatCurrency(Math.round(stats.averageRidePrice))}
            subtitle={`Range: ${formatCurrency(stats.lowestRidePrice)} - ${formatCurrency(stats.highestRidePrice)}`}
            icon={Target}
            color="from-amber-600 to-orange-400"
            delay={3}
          />
        </div>
      </section>

      {/* ========== CHARTS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rides Over Time */}
        <ChartCard title="Rides Over Time" subtitle="Daily ride activity" delay={0}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.ridesOverTime}>
              <defs>
                <linearGradient id={`ridesGradient-${universityId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`completedGradient-${universityId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 20 }} />
              <Area
                type="monotone"
                dataKey="rides"
                name="Total Rides"
                stroke={COLORS.primary}
                fill={`url(#ridesGradient-${universityId})`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke={COLORS.success}
                fill={`url(#completedGradient-${universityId})`}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cancelled"
                name="Cancelled"
                stroke={COLORS.danger}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Earnings Over Time */}
        <ChartCard title="Earnings Over Time" subtitle="Daily revenue" delay={1}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.earningsOverTime}>
              <defs>
                <linearGradient id={`earningsGradient-${universityId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="earnings"
                name="Earnings (PKR)"
                stroke={COLORS.success}
                fill={`url(#earningsGradient-${universityId})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Ride Status Distribution */}
        <ChartCard title="Ride Status Distribution" subtitle="Current status breakdown" delay={2}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.rideStatusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.rideStatusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Request Status Distribution */}
        <ChartCard title="Request Status Distribution" subtitle="Booking request breakdown" delay={3}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.requestStatusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.requestStatusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ========== PERFORMANCE METRICS ========== */}
      <ChartCard title="Performance Metrics" subtitle="Key performance indicators" delay={4}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Completion Rate', value: completionRate, color: COLORS.success },
            { label: 'Confirmation Rate', value: confirmationRate, color: COLORS.primary },
            { label: 'User Activity', value: userActivityRate, color: COLORS.info },
            { label: 'Cancellation Rate', value: 100 - cancellationRate, color: COLORS.warning },
          ].map((metric, i) => (
            <div key={i} className="relative">
              <ResponsiveContainer width="100%" height={120}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="100%"
                  data={[{ value: metric.value, fill: metric.color }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    background={{ fill: '#1e293b' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{metric.value.toFixed(0)}%</span>
                <span className="text-xs text-slate-400 text-center px-2">{metric.label}</span>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT - BI DASHBOARD WITH UNIVERSITY TABS
// ============================================================================

export default function UniversityBIDashboard() {
  const [activeUniversity, setActiveUniversity] = useState<'NED' | 'FAST'>('NED');
  const [timeRange, setTimeRange] = useState<TimeRange>(TIME_RANGES[1]); // Default 30 days
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Force re-render by toggling and toggling back
    const current = activeUniversity;
    setActiveUniversity(current === 'NED' ? 'FAST' : 'NED');
    setTimeout(() => {
      setActiveUniversity(current);
      setIsRefreshing(false);
    }, 100);
  };

  const universities = [
    { id: 'NED', name: 'NED University of Engineering & Technology', short: 'NED', color: 'from-blue-600 to-cyan-400' },
    { id: 'FAST', name: 'FAST National University', short: 'FAST', color: 'from-purple-600 to-pink-400' },
  ];

  return (
    <div className="space-y-6 [@media(max-height:700px)]:space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 [@media(max-height:700px)]:gap-3">
        {/* University Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
          {universities.map((uni) => (
            <button
              key={uni.id}
              onClick={() => setActiveUniversity(uni.id as 'NED' | 'FAST')}
              className={`relative flex items-center gap-2 px-5 py-2.5 [@media(max-height:700px)]:px-4 [@media(max-height:700px)]:py-2 rounded-lg font-medium transition-all duration-300 ${
                activeUniversity === uni.id
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {activeUniversity === uni.id && (
                <motion.div
                  layoutId="activeUniversityTab"
                  className={`absolute inset-0 bg-gradient-to-r ${uni.color} rounded-lg shadow-lg`}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {uni.short}
              </span>
            </button>
          ))}
        </div>

        {/* Time Range & Refresh */}
        <div className="flex items-center gap-3 [@media(max-height:700px)]:gap-2">
          {/* Time Range Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 [@media(max-height:700px)]:py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-all">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">{timeRange.label}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    timeRange.value === range.value
                      ? 'bg-primary/20 text-primary'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* University Dashboard */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeUniversity}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <UniversityDashboard
            universityId={activeUniversity}
            universityName={universities.find(u => u.id === activeUniversity)?.name || ''}
            timeRange={timeRange}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
