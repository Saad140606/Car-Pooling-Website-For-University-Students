"use client";

import React, { useState } from "react";
import {
  Users,
  Car,
  FileText,
  MessageSquare,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Activity,
  Building2,
  ArrowUpRight,
  Zap,
  Shield,
  Loader2,
} from "lucide-react";
import { useAdminAnalytics, UniversityStats } from "@/hooks/useAdminAnalytics";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type FilterType = "all" | "fast" | "ned" | "karachi";

export default function AdminDashboardPage() {
  // 🔒 SECURITY: Verify admin authentication
  const { loading: authLoading, isAdmin, error: authError } = useAdminAuth();
  const analytics = useAdminAnalytics();
  const [filter, setFilter] = useState<FilterType>("all");

  // 🔒 SECURITY: Block rendering until admin verification completes
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <Shield className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Verifying admin credentials...</p>
          <p className="text-slate-500 text-sm mt-2">Authenticating with backend...</p>
        </div>
      </div>
    );
  }

  // 🔒 SECURITY: Block access if not admin (will auto-redirect)
  if (!isAdmin || authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 text-lg">Unauthorized Access</p>
          <p className="text-slate-500 text-sm mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const getStats = (): UniversityStats => {
    switch (filter) {
      case "fast":
        return analytics.fast;
      case "ned":
        return analytics.ned;
      case "karachi":
        return analytics.karachi;
      default:
        return analytics.combined;
    }
  };

  const stats = getStats();

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Loading real-time analytics...</p>
          <p className="text-slate-500 text-sm mt-2">Connecting to Firestore...</p>
        </div>
      </div>
    );
  }

  if (analytics.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Failed to Load Analytics</h2>
          <p className="text-slate-400 mb-4">{analytics.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 flex items-center gap-3">
              <Activity className="w-8 h-8 md:w-10 md:h-10 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-slate-300 text-sm md:text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              Real-time analytics from Firestore
            </p>
          </div>

          {/* University Filter */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-800/70 p-1.5 rounded-xl border border-slate-700 shadow-xl">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All Universities
            </FilterButton>
            <FilterButton active={filter === "fast"} onClick={() => setFilter("fast")}>
              FAST
            </FilterButton>
            <FilterButton active={filter === "ned"} onClick={() => setFilter("ned")}>
              NED
            </FilterButton>
            <FilterButton active={filter === "karachi"} onClick={() => setFilter("karachi")}>
              Karachi
            </FilterButton>
          </div>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.users.total}
          subtitle={`${stats.users.verified} verified`}
          trend={stats.users.active}
          trendLabel="active"
          color="blue"
        />
        <StatCard
          icon={Car}
          title="Total Rides"
          value={stats.rides.total}
          subtitle={`${stats.rides.active} active`}
          trend={stats.rides.completed}
          trendLabel="completed"
          color="green"
        />
        <StatCard
          icon={FileText}
          title="Bookings"
          value={stats.bookings.total}
          subtitle={`${stats.bookings.confirmed} confirmed`}
          trend={stats.bookings.seatsBooked}
          trendLabel="seats booked"
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          title="Total Earnings"
          value={`Rs. ${stats.earnings.total.toLocaleString()}`}
          subtitle="From all rides"
          trend={0}
          trendLabel=""
          color="yellow"
          isMonetary
        />
      </div>

      {/* University Comparison */}
      {filter === "all" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <UniversityCard
            name="FAST University"
            color="blue"
            stats={analytics.fast}
          />
          <UniversityCard
            name="NED University"
            color="green"
            stats={analytics.ned}
          />
          <UniversityCard
            name="Karachi University"
            color="purple"
            stats={analytics.karachi}
          />
        </div>
      )}

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Users Breakdown */}
        <DetailCard title="Users Analytics" icon={Users}>
          <StatRow label="Total Users" value={stats.users.total} />
          <StatRow label="Verified Users" value={stats.users.verified} color="green" />
          <StatRow label="Unverified Users" value={stats.users.unverified} color="yellow" />
          <StatRow label="Active Users" value={stats.users.active} color="blue" />
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Verification Rate</span>
              <span className="text-white font-semibold">
                {stats.users.total > 0
                  ? Math.round((stats.users.verified / stats.users.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                style={{
                  width: `${stats.users.total > 0 ? (stats.users.verified / stats.users.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </DetailCard>

        {/* Rides Breakdown */}
        <DetailCard title="Rides Analytics" icon={Car}>
          <StatRow label="Total Rides" value={stats.rides.total} />
          <StatRow label="Active Rides" value={stats.rides.active} color="blue" />
          <StatRow label="Completed Rides" value={stats.rides.completed} color="green" />
          <StatRow label="Cancelled Rides" value={stats.rides.cancelled} color="red" />
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Completion Rate</span>
              <span className="text-white font-semibold">
                {stats.rides.total > 0
                  ? Math.round((stats.rides.completed / stats.rides.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{
                  width: `${stats.rides.total > 0 ? (stats.rides.completed / stats.rides.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </DetailCard>

        {/* Bookings Breakdown */}
        <DetailCard title="Bookings Analytics" icon={FileText}>
          <StatRow label="Total Bookings" value={stats.bookings.total} />
          <StatRow label="Confirmed" value={stats.bookings.confirmed} color="green" />
          <StatRow label="Pending" value={stats.bookings.pending} color="yellow" />
          <StatRow label="Cancelled" value={stats.bookings.cancelled} color="red" />
          <StatRow label="Seats Booked" value={stats.bookings.seatsBooked} color="purple" />
        </DetailCard>
      </div>

      {/* Reports & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Reports */}
        <DetailCard title="Reports Overview" icon={AlertTriangle}>
          <StatRow label="Total Reports" value={analytics.reports.total} />
          <StatRow label="Pending" value={analytics.reports.pending} color="yellow" />
          <StatRow label="In Progress" value={analytics.reports.inProgress} color="blue" />
          <StatRow label="Resolved" value={analytics.reports.resolved} color="green" />
          {Object.keys(analytics.reports.types).length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Report Types:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analytics.reports.types).map(([type, count]) => (
                  <span
                    key={type}
                    className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-300"
                  >
                    {type}: {count as number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DetailCard>

        {/* Messages */}
        <DetailCard title="Messages Analytics" icon={MessageSquare}>
          <StatRow label="Total Messages" value={stats.messages.total} />
          <StatRow label="Voice Messages" value={stats.messages.voice} color="purple" />
          <StatRow label="File/Image Messages" value={stats.messages.files} color="blue" />
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-2xl font-bold text-blue-400">{analytics.fast.messages.total}</p>
                <p className="text-xs text-slate-400">FAST Messages</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-2xl font-bold text-green-400">{analytics.ned.messages.total}</p>
                <p className="text-xs text-slate-400">NED Messages</p>
              </div>
              <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <p className="text-2xl font-bold text-purple-400">{analytics.karachi.messages.total}</p>
                <p className="text-xs text-slate-400">Karachi Messages</p>
              </div>
            </div>
          </div>
        </DetailCard>
      </div>

      {/* Trends Section */}
      <div className="bg-slate-800/60 backdrop-blur-sm border-2 border-slate-700/70 rounded-2xl p-5 md:p-6 shadow-xl mb-20">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-primary" />
          Weekly Trends (Last 7 Days)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <TrendChart title="New Users" data={analytics.trends.usersGrowth} />
          <TrendChart title="Rides Created" data={analytics.trends.ridesPerDay} />
          <TrendChart title="New Bookings" data={analytics.trends.bookingsPerDay} />
          <TrendChart title="Earnings" data={analytics.trends.earningsPerDay} isMonetary />
        </div>
      </div>

      {/* Live Indicator */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500/30 border-2 border-green-500/50 rounded-full backdrop-blur-md shadow-2xl">
          <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm md:text-base text-white font-bold">Live Data</span>
        </div>
      </div>
    </div>
  );
}

// ===== COMPONENTS =====

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-sm md:text-base font-semibold transition-all ${
        active
          ? "bg-primary text-white shadow-lg shadow-primary/30"
          : "text-slate-300 hover:text-white hover:bg-slate-700/70"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  color,
  isMonetary = false,
}: {
  icon: React.ElementType;
  title: string;
  value: number | string;
  subtitle: string;
  trend: number;
  trendLabel: string;
  color: "blue" | "green" | "purple" | "yellow" | "red";
  isMonetary?: boolean;
}) {
  const colorClasses = {
    blue: "from-blue-500/30 to-blue-600/10 border-blue-500/40 text-blue-300",
    green: "from-green-500/30 to-green-600/10 border-green-500/40 text-green-300",
    purple: "from-purple-500/30 to-purple-600/10 border-purple-500/40 text-purple-300",
    yellow: "from-yellow-500/30 to-yellow-600/10 border-yellow-500/40 text-yellow-300",
    red: "from-red-500/30 to-red-600/10 border-red-500/40 text-red-300",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color].split(" ").slice(0, 2).join(" ")} backdrop-blur-sm border-2 ${colorClasses[color].split(" ")[2]} rounded-2xl p-5 md:p-6 transition-all hover:scale-[1.03] hover:shadow-2xl shadow-lg`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 md:p-4 rounded-xl bg-slate-800/80 ${colorClasses[color].split(" ")[3]}`}>
          <Icon className="w-6 h-6 md:w-7 md:h-7" />
        </div>
        {trend > 0 && trendLabel && (
          <div className="flex items-center gap-1 text-xs md:text-sm text-slate-300 font-medium">
            <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
            <span>{trend} {trendLabel}</span>
          </div>
        )}
      </div>
      <div className="text-3xl md:text-4xl font-extrabold text-white mb-2">{value}</div>
      <div className="text-sm md:text-base text-white font-semibold">{title}</div>
      <div className="text-xs md:text-sm text-slate-300 mt-1">{subtitle}</div>
    </div>
  );
}

function UniversityCard({
  name,
  color,
  stats,
}: {
  name: string;
  color: "blue" | "green" | "purple";
  stats: UniversityStats;
}) {
  const colorClasses = {
    blue: "border-blue-500/40 from-blue-500/20 bg-blue-500/5",
    green: "border-green-500/40 from-green-500/20 bg-green-500/5",
    purple: "border-purple-500/40 from-purple-500/20 bg-purple-500/5",
  };

  const iconColorClass = color === "blue" ? "text-blue-300" : (color === "green" ? "text-green-300" : "text-purple-300");

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} to-transparent backdrop-blur-sm border-2 rounded-2xl p-5 md:p-6 shadow-xl`}
    >
      <div className="flex items-center gap-3 mb-6">
        <Building2 className={`w-8 h-8 md:w-10 md:h-10 ${iconColorClass}`} />
        <h3 className="text-xl md:text-2xl font-bold text-white">{name}</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MiniStat label="Users" value={stats.users.total} />
        <MiniStat label="Rides" value={stats.rides.total} />
        <MiniStat label="Bookings" value={stats.bookings.total} />
        <MiniStat label="Earnings" value={`Rs. ${stats.earnings.total.toLocaleString()}`} />
      </div>

      <div className="mt-5 pt-5 border-t border-slate-600/50 grid grid-cols-3 gap-3 md:gap-4">
        <div className="text-center bg-green-500/10 rounded-lg p-3 border border-green-500/20">
          <p className="text-xl md:text-2xl font-bold text-green-300">{stats.users.verified}</p>
          <p className="text-xs md:text-sm text-slate-300 mt-1">Verified</p>
        </div>
        <div className="text-center bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
          <p className="text-xl md:text-2xl font-bold text-blue-300">{stats.rides.active}</p>
          <p className="text-xs md:text-sm text-slate-300 mt-1">Active Rides</p>
        </div>
        <div className="text-center bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
          <p className="text-xl md:text-2xl font-bold text-purple-300">{stats.bookings.confirmed}</p>
          <p className="text-xs md:text-sm text-slate-300 mt-1">Confirmed</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <p className="text-2xl md:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs md:text-sm text-slate-300 mt-1">{label}</p>
    </div>
  );
}

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/60 backdrop-blur-sm border-2 border-slate-700/70 rounded-2xl p-5 md:p-6 shadow-xl">
      <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const colorClasses = {
    green: "text-green-300",
    yellow: "text-yellow-300",
    red: "text-red-300",
    blue: "text-blue-300",
    purple: "text-purple-300",
  };

  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-700/70 last:border-0">
      <span className="text-slate-300 text-sm md:text-base font-medium">{label}</span>
      <span className={`text-lg md:text-xl font-bold ${color ? colorClasses[color] : "text-white"}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function TrendChart({
  title,
  data,
  isMonetary = false,
}: {
  title: string;
  data: { date: string; fast: number; ned: number; karachi: number }[];
  isMonetary?: boolean;
}) {
  const maxValue = Math.max(...data.map((d) => d.fast + d.ned + d.karachi), 1);

  return (
    <div className="bg-slate-700/40 border border-slate-600/50 rounded-xl p-4 md:p-5 shadow-lg">
      <h4 className="text-sm md:text-base font-bold text-white mb-4">{title}</h4>
      <div className="flex items-end gap-1 h-24 md:h-28">
        {data.map((item, idx) => {
          const fastHeight = (item.fast / maxValue) * 100;
          const nedHeight = (item.ned / maxValue) * 100;
          const karachiHeight = (item.karachi / maxValue) * 100;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col gap-0.5" style={{ height: "90px" }}>
                <div
                  className="w-full bg-blue-400/80 rounded-t transition-all duration-300 hover:bg-blue-400"
                  style={{ height: `${fastHeight}%` }}
                  title={`FAST: ${isMonetary ? `Rs. ${item.fast}` : item.fast}`}
                />
                <div
                  className="w-full bg-green-400/80 transition-all duration-300 hover:bg-green-400"
                  style={{ height: `${nedHeight}%` }}
                  title={`NED: ${isMonetary ? `Rs. ${item.ned}` : item.ned}`}
                />
                <div
                  className="w-full bg-purple-400/80 rounded-b transition-all duration-300 hover:bg-purple-400"
                  style={{ height: `${karachiHeight}%` }}
                  title={`Karachi: ${isMonetary ? `Rs. ${item.karachi}` : item.karachi}`}
                />
              </div>
              <span className="text-[10px] md:text-xs text-slate-300 font-medium">
                {new Date(item.date).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-4 pt-3 border-t border-slate-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-400 rounded" />
          <span className="text-xs md:text-sm text-slate-200 font-medium">FAST</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-400 rounded" />
          <span className="text-xs md:text-sm text-slate-200 font-medium">NED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-purple-400 rounded" />
          <span className="text-xs md:text-sm text-slate-200 font-medium">Karachi</span>
        </div>
      </div>
    </div>
  );
}
