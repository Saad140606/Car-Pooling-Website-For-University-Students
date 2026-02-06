"use client";

import React, { useState } from "react";
import { BarChart3, TrendingUp, Calendar, Download, Filter } from "lucide-react";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

export default function AdminAnalyticsPage() {
  const analytics = useAdminAnalytics();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("7d");
  const [university, setUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <BarChart3 className="w-10 h-10 text-primary" />
              Advanced Analytics
            </h1>
            <p className="text-slate-400">Detailed insights and trends</p>
          </div>
          <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "90d")}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">University</label>
            <select
              value={university}
              onChange={(e) => setUniversity(e.target.value as "all" | "fast" | "ned" | "karachi")}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Universities</option>
              <option value="fast">FAST Only</option>
              <option value="ned">NED Only</option>
              <option value="karachi">Karachi Only</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2">
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Users Growth */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">User Growth</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">New Users (7 days)</span>
                <span className="text-lg font-bold text-blue-400">
                  {analytics.trends.usersGrowth.reduce((sum, d) => sum + d.fast + d.ned + d.karachi, 0)}
                </span>
              </div>
              <div className="flex h-2 gap-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="flex-1 bg-blue-500" />
                <div className="flex-1 bg-blue-400" />
                <div className="flex-1 bg-blue-300" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {analytics.fast.users.total}
                </p>
                <p className="text-xs text-slate-400">FAST Users</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">
                  {analytics.ned.users.total}
                </p>
                <p className="text-xs text-slate-400">NED Users</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {analytics.karachi.users.total}
                </p>
                <p className="text-xs text-slate-400">Karachi Users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Analytics */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Revenue Analytics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Total Earnings</span>
                <span className="text-lg font-bold text-green-400">
                  Rs. {analytics.combined.earnings.total.toLocaleString()}
                </span>
              </div>
              <div className="flex h-2 gap-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="flex-1 bg-green-500" />
                <div className="flex-1 bg-green-400" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">
                  Rs. {analytics.fast.earnings.total.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">FAST Earnings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  Rs. {analytics.ned.earnings.total.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">NED Earnings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">
                  Rs. {analytics.karachi.earnings.total.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">Karachi Earnings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rides Analytics */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Rides Performance</h3>
          <div className="space-y-4">
            <MetricItem label="Total Rides" value={analytics.combined.rides.total} color="blue" />
            <MetricItem label="Active Rides" value={analytics.combined.rides.active} color="green" />
            <MetricItem label="Completed" value={analytics.combined.rides.completed} color="purple" />
            <MetricItem label="Cancelled" value={analytics.combined.rides.cancelled} color="red" />
          </div>
        </div>

        {/* Bookings Analytics */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Bookings Performance</h3>
          <div className="space-y-4">
            <MetricItem label="Total Bookings" value={analytics.combined.bookings.total} color="blue" />
            <MetricItem label="Confirmed" value={analytics.combined.bookings.confirmed} color="green" />
            <MetricItem label="Pending" value={analytics.combined.bookings.pending} color="yellow" />
            <MetricItem label="Cancelled" value={analytics.combined.bookings.cancelled} color="red" />
          </div>
        </div>

        {/* Engagement Analytics */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Engagement Metrics</h3>
          <div className="space-y-4">
            <MetricItem label="Total Messages" value={analytics.combined.messages.total} color="purple" />
            <MetricItem label="Voice Messages" value={analytics.combined.messages.voice} color="pink" />
            <MetricItem label="Total Reports" value={analytics.reports.total} color="red" />
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-2">Verification Rate</p>
              <div className="flex h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-green-500"
                  style={{
                    width: `${analytics.combined.users.total > 0 ? (analytics.combined.users.verified / analytics.combined.users.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-sm text-green-400 mt-2">
                {analytics.combined.users.total > 0
                  ? Math.round((analytics.combined.users.verified / analytics.combined.users.total) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    pink: "text-pink-400",
  };

  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-semibold ${colors[color as keyof typeof colors]}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
