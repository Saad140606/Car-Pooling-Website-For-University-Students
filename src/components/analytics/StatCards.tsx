"use client";

import React, { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  Users,
  Star,
  Shield,
  Calendar,
  Route,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Target,
  Award,
  Activity,
  CheckCircle,
  XCircle,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// ANIMATED COUNTER
// ============================================================================

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

const AnimatedCounter = memo(function AnimatedCounter({
  end,
  duration = 1500,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(end * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
});

// ============================================================================
// STAT CARD VARIANTS
// ============================================================================

type CardVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'emerald' | 'amber';

const variantStyles: Record<CardVariant, {
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
  glow: string;
}> = {
  primary: {
    gradient: 'from-primary/20 via-primary/10 to-transparent',
    border: 'border-primary/30 hover:border-primary/50',
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    glow: 'shadow-primary/20',
  },
  success: {
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
    border: 'border-emerald-500/30 hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    glow: 'shadow-emerald-500/20',
  },
  warning: {
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    border: 'border-amber-500/30 hover:border-amber-500/50',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
    glow: 'shadow-amber-500/20',
  },
  error: {
    gradient: 'from-red-500/20 via-red-500/10 to-transparent',
    border: 'border-red-500/30 hover:border-red-500/50',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-500',
    glow: 'shadow-red-500/20',
  },
  info: {
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
    border: 'border-blue-500/30 hover:border-blue-500/50',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-500',
    glow: 'shadow-blue-500/20',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
    border: 'border-purple-500/30 hover:border-purple-500/50',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-500',
    glow: 'shadow-purple-500/20',
  },
  emerald: {
    gradient: 'from-emerald-400/20 via-emerald-400/10 to-transparent',
    border: 'border-emerald-400/30 hover:border-emerald-400/50',
    iconBg: 'bg-emerald-400/15',
    iconColor: 'text-emerald-400',
    glow: 'shadow-emerald-400/20',
  },
  amber: {
    gradient: 'from-amber-400/20 via-amber-400/10 to-transparent',
    border: 'border-amber-400/30 hover:border-amber-400/50',
    iconBg: 'bg-amber-400/15',
    iconColor: 'text-amber-400',
    glow: 'shadow-amber-400/20',
  },
};

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  variant?: CardVariant;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  delay?: number;
  compact?: boolean;
}

export const StatCard = memo(function StatCard({
  title,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  variant = 'primary',
  trend,
  trendLabel,
  subtitle,
  delay = 0,
  compact = false,
}: StatCardProps) {
  const styles = variantStyles[variant];

  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === null) return 'text-slate-400';
    if (trend > 0) return 'text-emerald-500';
    if (trend < 0) return 'text-red-500';
    return 'text-slate-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: delay * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        'relative overflow-hidden rounded-xl border backdrop-blur-md',
        'bg-gradient-to-br',
        styles.gradient,
        styles.border,
        'transition-all duration-300',
        `hover:shadow-lg ${styles.glow}`,
        compact ? 'p-4' : 'p-6'
      )}
    >
      {/* Background glow effect */}
      <div className={cn(
        'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30',
        styles.iconBg
      )} />

      <div className="relative z-10 space-y-2">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className={cn(
            'p-2 rounded-lg flex-shrink-0',
            styles.iconBg
          )}>
            <div className={cn('w-4 h-4 sm:w-5 sm:h-5', styles.iconColor)}>
              {icon}
            </div>
          </div>
          {trend !== undefined && (
            <div className={cn('flex items-center gap-0.5 text-xs sm:text-sm font-medium whitespace-nowrap', getTrendColor())}>
              {getTrendIcon()}
              <span className="tabular-nums">
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-xs sm:text-sm text-slate-400 mb-1 leading-snug">{title}</p>

        {/* Value */}
        <div className="flex items-baseline gap-1">
          {typeof value === 'number' ? (
            <AnimatedCounter
              end={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              className={cn('font-bold text-white', compact ? 'text-lg sm:text-2xl' : 'text-xl sm:text-3xl')}
            />
          ) : (
            <span className={cn('font-bold text-white break-words', compact ? 'text-lg sm:text-2xl' : 'text-xl sm:text-3xl')}>
              {prefix}{value}{suffix}
            </span>
          )}
        </div>

        {/* Subtitle or trend label */}
        {(subtitle || trendLabel) && (
          <p className="text-xs text-slate-500 mt-2 leading-snug">
            {subtitle || trendLabel}
          </p>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// STAT CARDS GRID
// ============================================================================

interface StatCardsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function StatCardsGrid({ children, columns = 4 }: StatCardsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 xs:grid-cols-2',
    3: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-3',
    4: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-3 sm:gap-4', gridCols[columns])}>
      {children}
    </div>
  );
}

// ============================================================================
// DRIVER STAT CARDS
// ============================================================================

interface DriverStatsProps {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  averageRating: number | null;
  trustScore: number;
  activeDays: number;
  totalDistanceKm: number;
  totalTimeMinutes: number;
  totalPassengers: number;
  seatEfficiency: number;
  totalEarnings: number;
  completionRate: number;
}

export function DriverStatCards({
  totalRides,
  completedRides,
  cancelledRides,
  averageRating,
  trustScore,
  activeDays,
  totalDistanceKm,
  totalTimeMinutes,
  totalPassengers,
  seatEfficiency,
  totalEarnings,
  completionRate,
}: DriverStatsProps) {
  return (
    <StatCardsGrid columns={4}>
      <StatCard
        title="Total Rides Provided"
        value={totalRides}
        icon={<Car className="w-full h-full" />}
        variant="primary"
        delay={0}
      />
      <StatCard
        title="Passengers Served"
        value={totalPassengers}
        icon={<Users className="w-full h-full" />}
        variant="info"
        delay={1}
      />
      <StatCard
        title="Total Earnings"
        value={totalEarnings}
        prefix="PKR "
        icon={<Wallet className="w-full h-full" />}
        variant="success"
        delay={2}
      />
      <StatCard
        title="Average Rating"
        value={averageRating || 0}
        suffix=" ★"
        decimals={1}
        icon={<Star className="w-full h-full" />}
        variant="amber"
        delay={3}
      />
      <StatCard
        title="Completed Rides"
        value={completedRides}
        icon={<CheckCircle className="w-full h-full" />}
        variant="emerald"
        delay={4}
      />
      <StatCard
        title="Cancellation Rate"
        value={totalRides > 0 ? Math.round((cancelledRides / totalRides) * 100) : 0}
        suffix="%"
        icon={<XCircle className="w-full h-full" />}
        variant={cancelledRides > totalRides * 0.2 ? 'error' : 'warning'}
        delay={5}
      />
      <StatCard
        title="Seat Efficiency"
        value={seatEfficiency}
        suffix="%"
        icon={<Target className="w-full h-full" />}
        variant="purple"
        delay={6}
      />
      <StatCard
        title="Trust Score"
        value={trustScore}
        suffix="/100"
        icon={<Shield className="w-full h-full" />}
        variant={trustScore >= 80 ? 'success' : trustScore >= 60 ? 'warning' : 'error'}
        delay={7}
      />
      <StatCard
        title="Active Days"
        value={activeDays}
        icon={<Calendar className="w-full h-full" />}
        variant="info"
        delay={8}
        compact
      />
      <StatCard
        title="Distance Traveled"
        value={totalDistanceKm}
        suffix=" km"
        decimals={1}
        icon={<Route className="w-full h-full" />}
        variant="primary"
        delay={9}
        compact
      />
      <StatCard
        title="Time on Road"
        value={Math.round(totalTimeMinutes / 60)}
        suffix=" hrs"
        icon={<Clock className="w-full h-full" />}
        variant="purple"
        delay={10}
        compact
      />
      <StatCard
        title="Completion Rate"
        value={completionRate}
        suffix="%"
        icon={<Activity className="w-full h-full" />}
        variant={completionRate >= 90 ? 'success' : 'warning'}
        delay={11}
        compact
      />
    </StatCardsGrid>
  );
}

// ============================================================================
// PASSENGER STAT CARDS
// ============================================================================

interface PassengerStatsProps {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  averageRating: number | null;
  trustScore: number;
  activeDays: number;
  totalDistanceKm: number;
  totalTimeMinutes: number;
  totalSpent: number;
  averageCostPerRide: number;
  requestToConfirmRate: number;
  ridesRequested: number;
}

export function PassengerStatCards({
  totalRides,
  completedRides,
  cancelledRides,
  averageRating,
  trustScore,
  activeDays,
  totalDistanceKm,
  totalTimeMinutes,
  totalSpent,
  averageCostPerRide,
  requestToConfirmRate,
  ridesRequested,
}: PassengerStatsProps) {
  return (
    <StatCardsGrid columns={4}>
      <StatCard
        title="Total Rides Taken"
        value={totalRides}
        icon={<Car className="w-full h-full" />}
        variant="primary"
        delay={0}
      />
      <StatCard
        title="Total Spent"
        value={totalSpent}
        prefix="PKR "
        icon={<Wallet className="w-full h-full" />}
        variant="info"
        delay={1}
      />
      <StatCard
        title="Avg Cost/Ride"
        value={averageCostPerRide}
        prefix="PKR "
        icon={<Percent className="w-full h-full" />}
        variant="purple"
        delay={2}
      />
      <StatCard
        title="Average Rating"
        value={averageRating || 0}
        suffix=" ★"
        decimals={1}
        icon={<Star className="w-full h-full" />}
        variant="amber"
        delay={3}
      />
      <StatCard
        title="Completed Rides"
        value={completedRides}
        icon={<CheckCircle className="w-full h-full" />}
        variant="emerald"
        delay={4}
      />
      <StatCard
        title="Rides Requested"
        value={ridesRequested}
        icon={<Activity className="w-full h-full" />}
        variant="info"
        delay={5}
      />
      <StatCard
        title="Booking Success Rate"
        value={requestToConfirmRate}
        suffix="%"
        icon={<Target className="w-full h-full" />}
        variant={requestToConfirmRate >= 80 ? 'success' : 'warning'}
        delay={6}
      />
      <StatCard
        title="Trust Score"
        value={trustScore}
        suffix="/100"
        icon={<Shield className="w-full h-full" />}
        variant={trustScore >= 80 ? 'success' : trustScore >= 60 ? 'warning' : 'error'}
        delay={7}
      />
      <StatCard
        title="Active Days"
        value={activeDays}
        icon={<Calendar className="w-full h-full" />}
        variant="info"
        delay={8}
        compact
      />
      <StatCard
        title="Distance Traveled"
        value={totalDistanceKm}
        suffix=" km"
        decimals={1}
        icon={<Route className="w-full h-full" />}
        variant="primary"
        delay={9}
        compact
      />
      <StatCard
        title="Time Commuting"
        value={Math.round(totalTimeMinutes / 60)}
        suffix=" hrs"
        icon={<Clock className="w-full h-full" />}
        variant="purple"
        delay={10}
        compact
      />
      <StatCard
        title="Cancellation Rate"
        value={totalRides > 0 ? Math.round((cancelledRides / totalRides) * 100) : 0}
        suffix="%"
        icon={<XCircle className="w-full h-full" />}
        variant={cancelledRides > totalRides * 0.2 ? 'error' : 'warning'}
        delay={11}
        compact
      />
    </StatCardsGrid>
  );
}

export default StatCard;
