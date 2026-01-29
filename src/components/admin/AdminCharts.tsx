"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Users, Car, Calendar, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

// ============================================================================
// ANIMATED CHART COMPONENTS FOR ADMIN DASHBOARD
// ============================================================================

interface AnimatedLineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  animate?: boolean;
}

export const AnimatedLineChart: React.FC<AnimatedLineChartProps> = ({
  data,
  height = 200,
  color = "#3F51B5",
  showGrid = true,
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
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
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

        {/* Gradient fill */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area under line */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#lineGradient)"
          className="transition-all duration-1000 ease-out"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-1000 ease-out"
        />

        {/* Data points */}
        {animatedData.map((value, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = ((maxValue - value) / maxValue) * 100;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              className="transition-all duration-1000 ease-out animate-pulse-glow"
            />
          );
        })}
      </svg>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-white/60">
        {data.map((item, idx) => (
          <span key={idx} className="animate-fade-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ANIMATED BAR CHART
// ============================================================================

interface AnimatedBarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showValues?: boolean;
  animate?: boolean;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  height = 200,
  showValues = true,
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

  return (
    <div className="w-full space-y-3">
      {data.map((item, idx) => {
        const percentage = (animatedData[idx] / maxValue) * 100;
        const barColor = item.color || "#3F51B5";

        return (
          <div key={idx} className="space-y-1 stagger-item" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/80 font-medium">{item.label}</span>
              {showValues && (
                <span className="text-white/60 tabular-nums">{item.value.toLocaleString()}</span>
              )}
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out relative"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: barColor,
                }}
              >
                <div
                  className="absolute inset-0 animate-shimmer"
                  style={{
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// STAT CARD WITH TREND
// ============================================================================

interface StatCardWithTrendProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: number; // percentage change
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  highlight?: boolean;
}

export const StatCardWithTrend: React.FC<StatCardWithTrendProps> = ({
  icon,
  label,
  value,
  trend,
  subtitle,
  variant = "default",
  highlight = false,
}) => {
  const variantStyles = {
    default: "from-primary/20 to-primary/5 border-primary/30",
    success: "from-green-500/20 to-green-500/5 border-green-500/30",
    warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    error: "from-red-500/20 to-red-500/5 border-red-500/30",
    info: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
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
        bg-gradient-to-br ${variantStyles[variant]}
        transition-all duration-300
        hover:scale-[1.02] hover:shadow-lg hover:border-opacity-50
        animate-scale-up
        ${highlight ? "shadow-glow" : ""}
      `}
    >
      {/* Icon */}
      <div className="flex items-start justify-between mb-4">
        <div className={`
          p-3 rounded-lg bg-gradient-to-br
          ${variant === "success" ? "from-green-500/20 to-green-500/5" : ""}
          ${variant === "warning" ? "from-amber-500/20 to-amber-500/5" : ""}
          ${variant === "error" ? "from-red-500/20 to-red-500/5" : ""}
          ${variant === "info" ? "from-blue-500/20 to-blue-500/5" : ""}
          ${variant === "default" ? "from-primary/20 to-primary/5" : ""}
        `}>
          <div className="w-6 h-6 text-white/90">
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-semibold tabular-nums">
              {trend > 0 ? "+" : ""}{trend}%
            </span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="space-y-1">
        <div className="text-3xl font-bold text-white tabular-nums animate-bounce-in">
          {value}
        </div>
        <div className="text-sm text-white/60">{label}</div>
        {subtitle && (
          <div className="text-xs text-white/40 mt-2">{subtitle}</div>
        )}
      </div>

      {/* Decorative gradient */}
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none" />
      )}
    </div>
  );
};

// ============================================================================
// DONUT CHART
// ============================================================================

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  centerText?: string;
  centerSubtext?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 200,
  thickness = 30,
  showLegend = true,
  centerText,
  centerSubtext,
}) => {
  const [animatedPercentages, setAnimatedPercentages] = useState<number[]>(data.map(() => 0));

  useEffect(() => {
    const timer = setTimeout(() => {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      setAnimatedPercentages(data.map((item) => (item.value / total) * 100));
    }, 100);

    return () => clearTimeout(timer);
  }, [data]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentAngle = -90; // Start from top

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Chart */}
      <div className="relative animate-scale-up" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={thickness}
          />

          {/* Data segments */}
          {animatedPercentages.map((percentage, idx) => {
            const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
            const rotation = currentAngle;
            currentAngle += (percentage / 100) * 360;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={data[idx].color}
                strokeWidth={thickness}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                }}
              />
            );
          })}
        </svg>

        {/* Center text */}
        {(centerText || centerSubtext) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerText && (
              <div className="text-2xl font-bold text-white tabular-nums">
                {centerText}
              </div>
            )}
            {centerSubtext && (
              <div className="text-sm text-white/60">{centerSubtext}</div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
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
                    {item.value} ({percentage}%)
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
// QUICK STATS GRID
// ============================================================================

interface QuickStatsGridProps {
  stats: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    trend?: number;
    variant?: "default" | "success" | "warning" | "error" | "info";
  }[];
}

export const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} style={{ animationDelay: `${idx * 80}ms` }}>
          <StatCardWithTrend {...stat} />
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// ACTIVITY TIMELINE
// ============================================================================

interface TimelineItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

interface ActivityTimelineProps {
  items: TimelineItem[];
  maxItems?: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  items,
  maxItems = 10,
}) => {
  const displayItems = items.slice(0, maxItems);

  const getTypeStyles = (type: TimelineItem["type"]) => {
    switch (type) {
      case "success":
        return { color: "bg-green-500", border: "border-green-500/30", glow: "shadow-[0_0_10px_rgba(34,197,94,0.3)]" };
      case "warning":
        return { color: "bg-amber-500", border: "border-amber-500/30", glow: "shadow-[0_0_10px_rgba(245,158,11,0.3)]" };
      case "error":
        return { color: "bg-red-500", border: "border-red-500/30", glow: "shadow-[0_0_10px_rgba(239,68,68,0.3)]" };
      case "info":
        return { color: "bg-blue-500", border: "border-blue-500/30", glow: "shadow-[0_0_10px_rgba(59,130,246,0.3)]" };
      default:
        return { color: "bg-primary", border: "border-primary/30", glow: "shadow-[0_0_10px_rgba(63,81,181,0.3)]" };
    }
  };

  const getDefaultIcon = (type: TimelineItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "error":
        return <XCircle className="w-4 h-4" />;
      case "info":
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="relative space-y-4">
      {/* Vertical line */}
      <div className="absolute left-4 top-8 bottom-8 w-px bg-white/10" />

      {displayItems.map((item, idx) => {
        const styles = getTypeStyles(item.type);

        return (
          <div
            key={item.id}
            className="relative flex gap-4 stagger-item"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            {/* Icon */}
            <div className={`
              relative z-10 flex-shrink-0 w-8 h-8 rounded-full
              flex items-center justify-center
              ${styles.color} ${styles.glow}
              animate-pulse-glow
            `}>
              <div className="text-white">
                {item.icon || getDefaultIcon(item.type)}
              </div>
            </div>

            {/* Content */}
            <div className={`
              flex-1 p-4 rounded-lg border backdrop-blur-sm
              bg-card/50 ${styles.border}
              hover:bg-card/70 hover:scale-[1.01]
              transition-all duration-300
            `}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white/90 mb-1">
                    {item.title}
                  </div>
                  <div className="text-sm text-white/60">
                    {item.description}
                  </div>
                </div>
                <div className="text-xs text-white/40 whitespace-nowrap">
                  {item.timestamp}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
