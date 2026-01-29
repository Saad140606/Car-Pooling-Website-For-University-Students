"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ============================================================================
// ANIMATED NUMBER COUNTER
// ============================================================================

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
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
    <span className={className}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
};

// ============================================================================
// ANIMATED AREA CHART
// ============================================================================

interface AreaChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showGrid?: boolean;
  showDots?: boolean;
  animate?: boolean;
}

export const AnimatedAreaChart: React.FC<AreaChartProps> = ({
  data,
  height = 200,
  color = "#3F51B5",
  gradientFrom = "rgba(63, 81, 181, 0.4)",
  gradientTo = "rgba(63, 81, 181, 0.05)",
  showGrid = true,
  showDots = true,
  animate = true,
}) => {
  const [animatedData, setAnimatedData] = useState<number[]>(
    animate ? data.map(() => 0) : data.map((d) => d.value)
  );

  useEffect(() => {
    if (!animate) return;

    const timer = setTimeout(() => {
      setAnimatedData(data.map((d) => d.value));
    }, 100);

    return () => clearTimeout(timer);
  }, [data, animate]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const points = animatedData
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = ((maxValue - value) / maxValue) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={`areaGradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-10">
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-white"
              />
            ))}
          </g>
        )}

        {/* Area fill */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill={`url(#areaGradient-${color})`}
          className="transition-all duration-1000 ease-out"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-1000 ease-out"
        />

        {/* Data points */}
        {showDots &&
          animatedData.map((value, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = ((maxValue - value) / maxValue) * 100;
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill={color}
                  className="transition-all duration-1000 ease-out"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="1.5"
                  fill="white"
                  className="transition-all duration-1000 ease-out animate-pulse-glow"
                />
              </g>
            );
          })}
      </svg>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-white/60">
        {data.map((item, idx) => (
          <span
            key={idx}
            className="animate-fade-slide-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ANIMATED PIE CHART
// ============================================================================

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  animate?: boolean;
}

export const AnimatedPieChart: React.FC<PieChartProps> = ({
  data,
  size = 200,
  showLegend = true,
  showPercentages = true,
  animate = true,
}) => {
  const [animatedPercentages, setAnimatedPercentages] = useState<number[]>(
    animate ? data.map(() => 0) : data.map(() => 100)
  );

  useEffect(() => {
    if (!animate) {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      setAnimatedPercentages(data.map((item) => (item.value / total) * 100));
      return;
    }

    const timer = setTimeout(() => {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      setAnimatedPercentages(data.map((item) => (item.value / total) * 100));
    }, 100);

    return () => clearTimeout(timer);
  }, [data, animate]);

  const center = size / 2;
  const radius = size / 2 - 10;

  let currentAngle = -90;
  const slices = animatedPercentages.map((percentage, idx) => {
    const startAngle = currentAngle;
    const sweepAngle = (percentage / 100) * 360;
    currentAngle += sweepAngle;

    const startX = center + radius * Math.cos((startAngle * Math.PI) / 180);
    const startY = center + radius * Math.sin((startAngle * Math.PI) / 180);
    const endX = center + radius * Math.cos(((startAngle + sweepAngle) * Math.PI) / 180);
    const endY = center + radius * Math.sin(((startAngle + sweepAngle) * Math.PI) / 180);

    const largeArcFlag = sweepAngle > 180 ? 1 : 0;

    return {
      path: `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
      color: data[idx].color,
      percentage: percentage,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={size}
        height={size}
        className="animate-scale-up"
        style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.2))" }}
      >
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={slice.path}
            fill={slice.color}
            className="transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer"
            style={{
              transformOrigin: "center",
            }}
          />
        ))}
      </svg>

      {showLegend && (
        <div className="grid grid-cols-2 gap-3 w-full">
          {data.map((item, idx) => {
            const total = data.reduce((sum, d) => sum + d.value, 0);
            const percentage = ((item.value / total) * 100).toFixed(1);

            return (
              <div
                key={idx}
                className="flex items-center gap-2 stagger-item"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div
                  className="w-3 h-3 rounded-full animate-pulse-glow"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{item.label}</div>
                  <div className="text-xs text-white/50 tabular-nums">
                    {showPercentages ? `${percentage}%` : item.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// METRIC CARD WITH TREND
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: "primary" | "success" | "warning" | "error" | "info" | "purple";
  animate?: boolean;
  subtitle?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  prefix = "",
  suffix = "",
  trend,
  trendLabel = "vs last period",
  icon,
  color = "primary",
  animate = true,
  subtitle,
}) => {
  const colorClasses = {
    primary: "from-primary/20 to-primary/5 border-primary/30",
    success: "from-green-500/20 to-green-500/5 border-green-500/30",
    warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    error: "from-red-500/20 to-red-500/5 border-red-500/30",
    info: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  };

  const iconColorClasses = {
    primary: "text-primary bg-primary/10",
    success: "text-green-500 bg-green-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    error: "text-red-500 bg-red-500/10",
    info: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
  };

  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-4 h-4" />;
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getTrendColor = () => {
    if (!trend) return "text-white/40";
    if (trend > 0) return "text-green-500";
    return "text-red-500";
  };

  return (
    <div
      className={`
        relative p-6 rounded-xl border backdrop-blur-sm
        bg-gradient-to-br ${colorClasses[color]}
        transition-all duration-300
        hover:scale-[1.02] hover:shadow-xl hover:border-opacity-50
        animate-scale-up group
      `}
    >
      {/* Icon */}
      {icon && (
        <div className={`inline-flex p-3 rounded-lg ${iconColorClasses[color]} mb-4`}>
          <div className="w-6 h-6">{icon}</div>
        </div>
      )}

      {/* Title */}
      <div className="text-sm text-white/60 mb-2">{title}</div>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-2">
        {animate && typeof value === "number" ? (
          <AnimatedCounter
            end={value}
            prefix={prefix}
            suffix={suffix}
            className="text-3xl font-bold text-white tabular-nums"
          />
        ) : (
          <span className="text-3xl font-bold text-white tabular-nums">
            {prefix}
            {value}
            {suffix}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && <div className="text-xs text-white/40 mb-2">{subtitle}</div>}

      {/* Trend */}
      {trend !== undefined && (
        <div className={`flex items-center gap-2 text-sm ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="font-semibold tabular-nums">
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
          <span className="text-white/40 text-xs">{trendLabel}</span>
        </div>
      )}

      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

// ============================================================================
// PROGRESS CIRCLE
// ============================================================================

interface ProgressCircleProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  animate?: boolean;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  color = "#3F51B5",
  label,
  sublabel,
  animate = true,
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(animate ? 0 : percentage);

  useEffect(() => {
    if (!animate) return;

    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [percentage, animate]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 animate-scale-up">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums">
            {Math.round(animatedPercentage)}%
          </span>
        </div>
      </div>

      {label && <div className="text-sm font-medium text-white/80">{label}</div>}
      {sublabel && <div className="text-xs text-white/50">{sublabel}</div>}
    </div>
  );
};

// ============================================================================
// SPARKLINE
// ============================================================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = "#3F51B5",
  showArea = true,
}) => {
  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      {showArea && (
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={color}
          opacity="0.2"
          className="transition-all duration-500"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
    </svg>
  );
};

// ============================================================================
// HEATMAP GRID
// ============================================================================

interface HeatmapProps {
  data: { day: string; hour: number; value: number }[];
  maxValue?: number;
  color?: string;
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, maxValue, color = "#3F51B5" }) => {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getValue = (day: string, hour: number) => {
    const item = data.find((d) => d.day === day && d.hour === hour);
    return item ? item.value : 0;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 min-w-max">
        <div className="flex gap-1 pl-12">
          {[0, 6, 12, 18, 23].map((hour) => (
            <div
              key={hour}
              className="text-xs text-white/60 w-8 text-center"
              style={{ marginLeft: hour === 0 ? 0 : "20px" }}
            >
              {hour}h
            </div>
          ))}
        </div>

        {days.map((day, dayIdx) => (
          <div
            key={day}
            className="flex items-center gap-1 stagger-item"
            style={{ animationDelay: `${dayIdx * 50}ms` }}
          >
            <div className="text-xs text-white/60 w-10 text-right">{day}</div>
            {hours.map((hour) => {
              const value = getValue(day, hour);
              const opacity = value / max;

              return (
                <div
                  key={`${day}-${hour}`}
                  className="w-8 h-6 rounded transition-all duration-300 hover:scale-110 cursor-pointer group relative"
                  style={{
                    backgroundColor: color,
                    opacity: Math.max(opacity, 0.1),
                  }}
                  title={`${day} ${hour}:00 - ${value} rides`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {value} rides
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
