"use client";

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Trophy,
  Shield,
  TrendingUp,
  Wallet,
  MapPin,
  CreditCard,
  CheckCircle,
  Award,
  Lightbulb,
  Sparkles,
  Zap,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyticsInsight, InsightType } from '@/lib/analyticsTypes';

// ============================================================================
// ICON MAPPER
// ============================================================================

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock,
  Trophy,
  Shield,
  TrendingUp,
  Wallet,
  MapPin,
  CreditCard,
  CheckCircle,
  Award,
  Lightbulb,
  Sparkles,
  Zap,
  Star,
  Target,
  Users,
};

// ============================================================================
// INSIGHT CARD
// ============================================================================

interface InsightCardProps {
  insight: AnalyticsInsight;
  index: number;
}

const InsightCard = memo(function InsightCard({ insight, index }: InsightCardProps) {
  const colorClasses = {
    primary: {
      bg: 'from-primary/20 via-primary/10 to-transparent',
      border: 'border-primary/30',
      icon: 'bg-primary/15 text-primary',
      glow: 'shadow-primary/10',
    },
    success: {
      bg: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      border: 'border-emerald-500/30',
      icon: 'bg-emerald-500/15 text-emerald-500',
      glow: 'shadow-emerald-500/10',
    },
    warning: {
      bg: 'from-amber-500/20 via-amber-500/10 to-transparent',
      border: 'border-amber-500/30',
      icon: 'bg-amber-500/15 text-amber-500',
      glow: 'shadow-amber-500/10',
    },
    info: {
      bg: 'from-blue-500/20 via-blue-500/10 to-transparent',
      border: 'border-blue-500/30',
      icon: 'bg-blue-500/15 text-blue-500',
      glow: 'shadow-blue-500/10',
    },
    purple: {
      bg: 'from-purple-500/20 via-purple-500/10 to-transparent',
      border: 'border-purple-500/30',
      icon: 'bg-purple-500/15 text-purple-500',
      glow: 'shadow-purple-500/10',
    },
  };

  const colors = colorClasses[insight.color] || colorClasses.primary;
  const IconComponent = iconMap[insight.icon] || Lightbulb;

  const typeLabels: Record<InsightType, string> = {
    activity_pattern: 'Activity Pattern',
    performance: 'Performance',
    comparison: 'Comparison',
    trend: 'Trend',
    suggestion: 'Suggestion',
    achievement: 'Achievement',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        'relative overflow-hidden rounded-xl border backdrop-blur-md p-5',
        'bg-gradient-to-br',
        colors.bg,
        colors.border,
        'hover:shadow-lg transition-all duration-300',
        colors.glow
      )}
    >
      {/* Decorative glow */}
      <div className={cn(
        'absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-50',
        colors.icon.replace('text-', 'bg-').replace('/15', '/20')
      )} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-lg', colors.icon)}>
            <IconComponent className="w-5 h-5" />
          </div>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            {typeLabels[insight.type]}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-base font-semibold text-white mb-2">{insight.title}</h4>

        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed">{insight.description}</p>

        {/* Value badge */}
        {insight.value && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full">
            {insight.trend === 'up' && (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
            {insight.trend === 'down' && (
              <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
            )}
            <span className="text-sm font-medium text-white">{insight.value}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// INSIGHTS GRID
// ============================================================================

interface InsightsGridProps {
  insights: AnalyticsInsight[];
  isLoading?: boolean;
}

export const InsightsGrid = memo(function InsightsGrid({
  insights,
  isLoading = false,
}: InsightsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-40 rounded-xl bg-slate-900/50 border border-slate-800/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-slate-800/50 mb-4">
          <Lightbulb className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Insights Yet</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Complete more rides to unlock personalized insights about your activity patterns,
          performance, and achievements.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {insights.map((insight, index) => (
        <InsightCard key={insight.id} insight={insight} index={index} />
      ))}
    </div>
  );
});

// ============================================================================
// INSIGHTS SECTION WITH HEADER
// ============================================================================

interface InsightsSectionProps {
  insights: AnalyticsInsight[];
  isLoading?: boolean;
}

export const InsightsSection = memo(function InsightsSection({
  insights,
  isLoading = false,
}: InsightsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-purple-500/15">
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Smart Insights</h2>
            <p className="text-xs sm:text-sm text-slate-500">Personalized analysis based on your activity</p>
          </div>
        </div>
        {insights.length > 0 && (
          <span className="text-xs sm:text-sm text-slate-500">
            {insights.length} insight{insights.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Insights Grid */}
      <InsightsGrid insights={insights} isLoading={isLoading} />
    </motion.div>
  );
});

// ============================================================================
// ACHIEVEMENT BADGE (BONUS)
// ============================================================================

interface AchievementBadgeProps {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
}

export const AchievementBadge = memo(function AchievementBadge({
  title,
  description,
  icon,
  unlocked,
  progress,
}: AchievementBadgeProps) {
  const IconComponent = iconMap[icon] || Trophy;

  return (
    <motion.div
      whileHover={unlocked ? { scale: 1.05 } : undefined}
      className={cn(
        'relative p-4 rounded-xl border backdrop-blur-md',
        unlocked
          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30'
          : 'bg-slate-900/30 border-slate-800/50 opacity-60'
      )}
    >
      <div className={cn(
        'p-3 rounded-lg mb-3 w-fit',
        unlocked ? 'bg-amber-500/20' : 'bg-slate-800/50'
      )}>
        <IconComponent className={cn(
          'w-6 h-6',
          unlocked ? 'text-amber-500' : 'text-slate-600'
        )} />
      </div>

      <h4 className={cn(
        'text-sm font-semibold mb-1',
        unlocked ? 'text-white' : 'text-slate-500'
      )}>
        {title}
      </h4>

      <p className={cn(
        'text-xs',
        unlocked ? 'text-slate-400' : 'text-slate-600'
      )}>
        {description}
      </p>

      {!unlocked && progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-slate-600 rounded-full"
            />
          </div>
          <p className="text-xs text-slate-600 mt-1">{progress}% complete</p>
        </div>
      )}

      {unlocked && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="w-5 h-5 text-amber-500" />
        </div>
      )}
    </motion.div>
  );
});

// ============================================================================
// QUICK STATS BAR
// ============================================================================

interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
}

interface QuickStatsBarProps {
  stats: QuickStat[];
}

export const QuickStatsBar = memo(function QuickStatsBar({ stats }: QuickStatsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-900/50 border border-slate-800/50 rounded-xl backdrop-blur-md [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-3"
    >
      {stats.map((stat, index) => {
        const IconComponent = iconMap[stat.icon] || Zap;
        return (
          <div
            key={index}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-800/50 rounded-lg min-w-0 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1"
          >
            <IconComponent className="w-4 h-4 text-primary [@media(max-height:700px)]:w-3.5 [@media(max-height:700px)]:h-3.5" />
            <span className="text-xs sm:text-sm text-slate-400 truncate [@media(max-height:700px)]:text-xs">{stat.label}:</span>
            <span className="text-xs sm:text-sm font-semibold text-white truncate [@media(max-height:700px)]:text-xs">{stat.value}</span>
          </div>
        );
      })}
    </motion.div>
  );
});

export default InsightsSection;
