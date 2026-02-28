"use client";

import React, { memo, useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { cn } from '@/lib/utils';
import { TimeSeriesDataPoint, RideActivityDataPoint } from '@/lib/analyticsTypes';

// ============================================================================
// CHART COLORS
// ============================================================================

const CHART_COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4',
  emerald: '#34D399',
  amber: '#FBBF24',
  slate: '#64748B',
};

const PIE_COLORS = [
  '#10B981', // Completed - emerald
  '#3B82F6', // Active - blue
  '#F59E0B', // Pending - amber
  '#EF4444', // Cancelled - red
  '#8B5CF6', // Other - purple
];

const useCompactHeight = (height: number, compactHeight: number) => {
  const [resolvedHeight, setResolvedHeight] = useState(height);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const isCompact = window.innerHeight <= 700;
      setResolvedHeight(isCompact ? Math.min(height, compactHeight) : height);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [height, compactHeight]);

  return resolvedHeight;
};

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

interface CustomTooltipProps extends TooltipProps<number, string> {
  prefix?: string;
  suffix?: string;
}

const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  label,
  prefix = '',
  suffix = '',
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg p-3 shadow-xl"
    >
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm font-semibold flex items-center gap-2"
          style={{ color: entry.color }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {prefix}{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}{suffix}
        </p>
      ))}
    </motion.div>
  );
});

// ============================================================================
// CHART WRAPPER
// ============================================================================

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const ChartWrapper = memo(function ChartWrapper({
  title,
  subtitle,
  children,
  delay = 0,
  className,
}: ChartWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.15 }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-slate-800/50',
        'bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80',
        'backdrop-blur-md p-4 sm:p-6 [@media(max-height:700px)]:p-3',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 [@media(max-height:700px)]:mb-2">
        <h3 className="text-lg font-semibold text-white [@media(max-height:700px)]:text-base">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1 [@media(max-height:700px)]:text-xs">{subtitle}</p>}
      </div>

      {/* Chart content */}
      <div className="relative">{children}</div>

      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
    </motion.div>
  );
});

// ============================================================================
// LINE CHART
// ============================================================================

interface RidesLineChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  color?: string;
  showArea?: boolean;
  height?: number;
}

export const RidesLineChart = memo(function RidesLineChart({
  data,
  title = 'Rides Over Time',
  color = CHART_COLORS.primary,
  showArea = true,
  height = 300,
}: RidesLineChartProps) {
  const resolvedHeight = useCompactHeight(height, 220);
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.label || d.date,
      value: d.value,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <ChartWrapper title={title}>
        <div className="flex items-center justify-center text-slate-500" style={{ height: resolvedHeight }}>
          No data available
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle="Last 30 days activity">
      <ResponsiveContainer width="100%" height={resolvedHeight}>
        {showArea ? (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              name="Rides"
              stroke={color}
              strokeWidth={2}
              fill="url(#colorValue)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              name="Rides"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

// ============================================================================
// EARNINGS/SPENDING AREA CHART
// ============================================================================

interface EarningsChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  isSpending?: boolean;
  height?: number;
}

export const EarningsChart = memo(function EarningsChart({
  data,
  title = 'Earnings Over Time',
  isSpending = false,
  height = 300,
}: EarningsChartProps) {
  const resolvedHeight = useCompactHeight(height, 220);
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.label || d.date,
      value: d.value,
    }));
  }, [data]);

  const color = isSpending ? CHART_COLORS.error : CHART_COLORS.success;
  const gradientId = isSpending ? 'spendingGradient' : 'earningsGradient';

  if (data.length === 0) {
    return (
      <ChartWrapper title={title}>
        <div className="flex items-center justify-center text-slate-500" style={{ height: resolvedHeight }}>
          No data available
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle="Financial trends over time">
      <ResponsiveContainer width="100%" height={resolvedHeight}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `PKR ${value}`}
          />
          <Tooltip content={<CustomTooltip prefix="PKR " />} />
          <Area
            type="monotone"
            dataKey="value"
            name={isSpending ? 'Spent' : 'Earned'}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

// ============================================================================
// WEEKLY ACTIVITY BAR CHART
// ============================================================================

interface WeeklyActivityChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  height?: number;
}

export const WeeklyActivityChart = memo(function WeeklyActivityChart({
  data,
  title = 'Weekly Activity',
  height = 250,
}: WeeklyActivityChartProps) {
  const resolvedHeight = useCompactHeight(height, 190);
  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.label || d.date,
      rides: d.value,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <ChartWrapper title={title}>
        <div className="flex items-center justify-center text-slate-500" style={{ height: resolvedHeight }}>
          No data available
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle="Rides by day of week">
      <ResponsiveContainer width="100%" height={resolvedHeight}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="rides"
            name="Rides"
            fill={CHART_COLORS.primary}
            radius={[4, 4, 0, 0]}
            animationDuration={1500}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === chartData.reduce((maxI, e, i, arr) => e.rides > arr[maxI].rides ? i : maxI, 0) 
                  ? CHART_COLORS.success 
                  : CHART_COLORS.primary
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

// ============================================================================
// RIDE STATUS PIE CHART
// ============================================================================

interface StatusPieChartProps {
  data: { label: string; value: number; color: string }[];
  title?: string;
  height?: number;
}

export const StatusPieChart = memo(function StatusPieChart({
  data,
  title = 'Ride Status Breakdown',
  height = 300,
}: StatusPieChartProps) {
  const resolvedHeight = useCompactHeight(height, 220);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (data.length === 0 || total === 0) {
    return (
      <ChartWrapper title={title}>
        <div className="flex items-center justify-center text-slate-500" style={{ height: resolvedHeight }}>
          No data available
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper title={title} subtitle={`Total: ${total} rides`}>
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <ResponsiveContainer width="100%" height={resolvedHeight}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
              animationDuration={1500}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload;
                const percentage = ((item.value / total) * 100).toFixed(1);
                return (
                  <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg p-3 shadow-xl">
                    <p className="text-sm font-semibold" style={{ color: item.color }}>
                      {item.label}
                    </p>
                    <p className="text-sm text-slate-300">
                      {item.value} rides ({percentage}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap lg:flex-col gap-3 justify-center">
          {data.map((entry, index) => {
            const percentage = ((entry.value / total) * 100).toFixed(1);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-slate-300">
                  {entry.label}: <span className="font-semibold text-white">{entry.value}</span>
                  <span className="text-slate-500 ml-1">({percentage}%)</span>
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </ChartWrapper>
  );
});

// ============================================================================
// ACTIVITY HEATMAP
// ============================================================================

interface ActivityHeatmapProps {
  data: RideActivityDataPoint[];
  title?: string;
}

export const ActivityHeatmap = memo(function ActivityHeatmap({
  data,
  title = 'Ride Activity Heatmap',
}: ActivityHeatmapProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  const getValue = (day: string, hour: number): number => {
    const item = data.find(d => d.day === day && d.hour === hour);
    return item?.value || 0;
  };

  const getColor = (value: number): string => {
    if (value === 0) return 'bg-slate-800/50';
    const intensity = value / maxValue;
    if (intensity > 0.8) return 'bg-primary';
    if (intensity > 0.6) return 'bg-primary/80';
    if (intensity > 0.4) return 'bg-primary/60';
    if (intensity > 0.2) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  return (
    <ChartWrapper title={title} subtitle="Activity by day and hour">
      <div className="overflow-x-auto">
        <div className="min-w-[360px] sm:min-w-[600px] [@media(max-height:700px)]:min-w-[520px]">
          {/* Hour labels */}
          <div className="flex gap-1 mb-1 pl-12 [@media(max-height:700px)]:pl-10">
            {[0, 6, 12, 18, 23].map(hour => (
              <div
                key={hour}
                className="text-xs text-slate-500 [@media(max-height:700px)]:text-[10px]"
                style={{ width: '28px', marginLeft: hour === 0 ? 0 : 'auto' }}
              >
                {hour}h
              </div>
            ))}
          </div>

          {/* Grid */}
          {days.map((day, dayIdx) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: dayIdx * 0.05 }}
              className="flex items-center gap-1 mb-1"
            >
              <div className="w-10 text-xs text-slate-500 text-right pr-2 [@media(max-height:700px)]:text-[10px] [@media(max-height:700px)]:w-8">{day}</div>
              {hours.map(hour => {
                const value = getValue(day, hour);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={cn(
                      'w-5 h-5 rounded-sm transition-all duration-200 hover:scale-125 cursor-pointer relative group [@media(max-height:700px)]:w-4 [@media(max-height:700px)]:h-4',
                      getColor(value)
                    )}
                    title={`${day} ${hour}:00 - ${value} rides`}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      {value} rides
                    </div>
                  </div>
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>
    </ChartWrapper>
  );
});

// ============================================================================
// PROGRESS CIRCLE COMPONENT
// ============================================================================

interface ProgressCircleProps {
  percentage: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const ProgressCircle = memo(function ProgressCircle({
  percentage,
  label,
  sublabel,
  size = 120,
  strokeWidth = 8,
  color = CHART_COLORS.primary,
}: ProgressCircleProps) {
  const [resolvedSize, setResolvedSize] = useState(size);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      if (window.innerWidth <= 360) {
        setResolvedSize(Math.min(size, 92));
        return;
      }
      if (window.innerWidth <= 420) {
        setResolvedSize(Math.min(size, 104));
        return;
      }
      setResolvedSize(size);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [size]);

  const resolvedStroke = resolvedSize <= 104 ? Math.max(6, strokeWidth - 1) : strokeWidth;
  const radius = (resolvedSize - resolvedStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center"
    >
      <div className="relative" style={{ width: resolvedSize, height: resolvedSize }}>
        <svg width={resolvedSize} height={resolvedSize} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={resolvedSize / 2}
            cy={resolvedSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={resolvedStroke}
          />
          {/* Progress circle */}
          <motion.circle
            cx={resolvedSize / 2}
            cy={resolvedSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={resolvedStroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold text-white', resolvedSize <= 104 ? 'text-lg' : 'text-2xl')}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <p className="text-xs sm:text-sm font-medium text-white mt-2 text-center">{label}</p>
      {sublabel && <p className="text-[11px] sm:text-xs text-slate-500 text-center">{sublabel}</p>}
    </motion.div>
  );
});

// ============================================================================
// MINI SPARKLINE
// ============================================================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export const Sparkline = memo(function Sparkline({
  data,
  color = CHART_COLORS.primary,
  height = 40,
  width = 120,
}: SparklineProps) {
  if (data.length === 0) return null;

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#sparklineGradient)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export default {
  RidesLineChart,
  EarningsChart,
  WeeklyActivityChart,
  StatusPieChart,
  ActivityHeatmap,
  ProgressCircle,
  Sparkline,
  ChartWrapper,
};
