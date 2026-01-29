"use client";

import React, { useState } from "react";
import {
  Users,
  Car,
  Eye,
  AlertCircle,
  TrendingUp,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import { AnalyticsLayout, DateRange } from "@/components/analytics/AnalyticsLayout";
import {
  MetricCard,
  AnimatedAreaChart,
  AnimatedPieChart,
  ProgressCircle,
  Sparkline,
  Heatmap,
} from "@/components/analytics/AnalyticsCharts";

// Mock data for NED - replace with real data from Firebase
const mockData = {
  users: {
    total: 3124,
    active: 2156,
    newSignups: 287,
    growth: 15.2,
    weeklyData: [
      { label: "Mon", value: 410 },
      { label: "Tue", value: 460 },
      { label: "Wed", value: 495 },
      { label: "Thu", value: 470 },
      { label: "Fri", value: 540 },
      { label: "Sat", value: 450 },
      { label: "Sun", value: 390 },
    ],
  },
  rides: {
    requested: 1823,
    completed: 1567,
    pending: 112,
    cancelled: 144,
    completionRate: 86.0,
    distribution: [
      { label: "Completed", value: 1567, color: "#10b981" },
      { label: "Pending", value: 112, color: "#f59e0b" },
      { label: "Cancelled", value: 144, color: "#ef4444" },
    ],
  },
  engagement: {
    pageViews: 18650,
    avgSessionDuration: "5m 12s",
    popularPages: [
      { page: "Dashboard", views: 5234 },
      { page: "Find Rides", views: 4512 },
      { page: "My Rides", views: 3640 },
      { page: "Profile", views: 2456 },
      { page: "Chat", views: 1808 },
    ],
    weeklyViews: [
      { label: "Mon", value: 2540 },
      { label: "Tue", value: 2750 },
      { label: "Wed", value: 2900 },
      { label: "Thu", value: 2680 },
      { label: "Fri", value: 3150 },
      { label: "Sat", value: 2320 },
      { label: "Sun", value: 2310 },
    ],
  },
  reports: {
    total: 56,
    pending: 15,
    resolved: 38,
    rejected: 3,
    categories: [
      { label: "Safety Issues", value: 21, color: "#ef4444" },
      { label: "Payment", value: 15, color: "#f59e0b" },
      { label: "User Behavior", value: 11, color: "#3b82f6" },
      { label: "Technical", value: 6, color: "#8b5cf6" },
      { label: "Other", value: 3, color: "#6b7280" },
    ],
  },
  heatmap: [
    { day: "Mon", hour: 7, value: 38 },
    { day: "Mon", hour: 8, value: 52 },
    { day: "Mon", hour: 9, value: 60 },
    { day: "Mon", hour: 17, value: 75 },
    { day: "Mon", hour: 18, value: 80 },
    { day: "Tue", hour: 7, value: 40 },
    { day: "Tue", hour: 8, value: 55 },
    { day: "Tue", hour: 9, value: 62 },
    { day: "Tue", hour: 17, value: 72 },
    { day: "Tue", hour: 18, value: 78 },
    { day: "Wed", hour: 7, value: 42 },
    { day: "Wed", hour: 8, value: 58 },
    { day: "Wed", hour: 9, value: 65 },
    { day: "Wed", hour: 17, value: 78 },
    { day: "Wed", hour: 18, value: 82 },
    { day: "Thu", hour: 7, value: 39 },
    { day: "Thu", hour: 8, value: 54 },
    { day: "Thu", hour: 9, value: 61 },
    { day: "Thu", hour: 17, value: 74 },
    { day: "Thu", hour: 18, value: 79 },
    { day: "Fri", hour: 7, value: 45 },
    { day: "Fri", hour: 8, value: 62 },
    { day: "Fri", hour: 9, value: 68 },
    { day: "Fri", hour: 17, value: 82 },
    { day: "Fri", hour: 18, value: 88 },
    { day: "Sat", hour: 10, value: 42 },
    { day: "Sat", hour: 14, value: 48 },
    { day: "Sat", hour: 20, value: 45 },
    { day: "Sun", hour: 10, value: 38 },
    { day: "Sun", hour: 14, value: 44 },
    { day: "Sun", hour: 20, value: 40 },
  ],
  recentRides: [
    {
      id: "N001",
      from: "NED Campus",
      to: "Saddar",
      driver: "Bilal Hassan",
      status: "completed",
      time: "1 hour ago",
    },
    {
      id: "N002",
      from: "Karachi",
      to: "NED Campus",
      driver: "Ayesha Malik",
      status: "active",
      time: "20 mins ago",
    },
    {
      id: "N003",
      from: "NED Campus",
      to: "Clifton",
      driver: "Usman Ali",
      status: "pending",
      time: "45 mins ago",
    },
    {
      id: "N004",
      from: "Gulshan",
      to: "NED Campus",
      driver: "Zainab Khan",
      status: "completed",
      time: "2 hours ago",
    },
    {
      id: "N005",
      from: "NED Campus",
      to: "DHA",
      driver: "Imran Sheikh",
      status: "cancelled",
      time: "4 hours ago",
    },
  ],
};

export default function NEDAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
    preset: "Last 7 Days",
  });

  const [filters, setFilters] = useState({
    rideType: [] as string[],
    userType: [] as string[],
    status: [] as string[],
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  const handleExport = () => {
    console.log("Exporting NED data...");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500 bg-green-500/10";
      case "active":
        return "text-blue-500 bg-blue-500/10";
      case "pending":
        return "text-amber-500 bg-amber-500/10";
      case "cancelled":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-white/60 bg-white/5";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "active":
        return <Activity className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <AnalyticsLayout
      title="NED Analytics Dashboard"
      portalName="NED"
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onRefresh={handleRefresh}
      onExport={handleExport}
      isLoading={isLoading}
      filters={[
        {
          label: "Ride Type",
          options: [
            { id: "shared", label: "Shared Rides", value: "shared" },
            { id: "private", label: "Private Rides", value: "private" },
          ],
          selected: filters.rideType,
          onChange: (selected) => setFilters({ ...filters, rideType: selected }),
        },
        {
          label: "User Type",
          options: [
            { id: "drivers", label: "Drivers", value: "drivers" },
            { id: "passengers", label: "Passengers", value: "passengers" },
          ],
          selected: filters.userType,
          onChange: (selected) => setFilters({ ...filters, userType: selected }),
        },
        {
          label: "Status",
          options: [
            { id: "active", label: "Active", value: "active" },
            { id: "completed", label: "Completed", value: "completed" },
            { id: "cancelled", label: "Cancelled", value: "cancelled" },
          ],
          selected: filters.status,
          onChange: (selected) => setFilters({ ...filters, status: selected }),
        },
      ]}
    >
      {/* User Analytics */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 animate-fade-slide-up">
          <Users className="w-5 h-5 text-purple-500" />
          User Analytics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Users"
            value={mockData.users.total}
            icon={<Users />}
            color="purple"
            trend={mockData.users.growth}
            trendLabel="vs last period"
          />
          <MetricCard
            title="Active Users"
            value={mockData.users.active}
            icon={<Activity />}
            color="success"
            subtitle="In the last 7 days"
          />
          <MetricCard
            title="New Signups"
            value={mockData.users.newSignups}
            icon={<TrendingUp />}
            color="info"
            trend={20.5}
            trendLabel="vs last period"
          />
          <MetricCard
            title="Growth Rate"
            value={`${mockData.users.growth}%`}
            icon={<TrendingUp />}
            color="purple"
            animate={false}
          />
        </div>

        <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
          <h3 className="text-lg font-semibold text-white mb-4">Weekly User Activity</h3>
          <AnimatedAreaChart
            data={mockData.users.weeklyData}
            height={250}
            color="#9333ea"
            gradientFrom="rgba(147, 51, 234, 0.4)"
            gradientTo="rgba(147, 51, 234, 0.05)"
            showGrid
            showDots
          />
        </div>
      </section>

      {/* Ride Analytics */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 animate-fade-slide-up">
          <Car className="w-5 h-5 text-purple-500" />
          Ride Analytics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Requests"
            value={mockData.rides.requested}
            icon={<Car />}
            color="purple"
          />
          <MetricCard
            title="Completed Rides"
            value={mockData.rides.completed}
            icon={<CheckCircle />}
            color="success"
          />
          <MetricCard
            title="Pending Rides"
            value={mockData.rides.pending}
            icon={<Clock />}
            color="warning"
          />
          <MetricCard
            title="Cancelled Rides"
            value={mockData.rides.cancelled}
            icon={<XCircle />}
            color="error"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
            <h3 className="text-lg font-semibold text-white mb-4">Ride Distribution</h3>
            <AnimatedPieChart data={mockData.rides.distribution} showLegend showPercentages />
          </div>

          <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-6">Completion Rate</h3>
              <ProgressCircle
                percentage={mockData.rides.completionRate}
                size={180}
                color="#10b981"
                label="Success Rate"
                sublabel="Based on all rides"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Engagement Metrics */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 animate-fade-slide-up">
          <Eye className="w-5 h-5 text-purple-500" />
          Views & Engagement
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Page Views"
            value={mockData.engagement.pageViews}
            icon={<Eye />}
            color="info"
            trend={11.2}
          />
          <MetricCard
            title="Avg Session Duration"
            value={mockData.engagement.avgSessionDuration}
            icon={<Clock />}
            color="purple"
            animate={false}
          />
          <MetricCard
            title="Popular Pages"
            value={mockData.engagement.popularPages.length}
            icon={<TrendingUp />}
            color="success"
            subtitle="Tracked pages"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
            <h3 className="text-lg font-semibold text-white mb-4">Weekly Page Views</h3>
            <AnimatedAreaChart
              data={mockData.engagement.weeklyViews}
              height={250}
              color="#3b82f6"
              gradientFrom="rgba(59, 130, 246, 0.4)"
              gradientTo="rgba(59, 130, 246, 0.05)"
              showGrid
              showDots
            />
          </div>

          <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
            <h3 className="text-lg font-semibold text-white mb-4">Most Popular Pages</h3>
            <div className="space-y-3">
              {mockData.engagement.popularPages.map((page, idx) => {
                const maxViews = mockData.engagement.popularPages[0].views;
                const percentage = (page.views / maxViews) * 100;

                return (
                  <div
                    key={idx}
                    className="stagger-item"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white/80">{page.page}</span>
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {page.views.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Reports Overview */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 animate-fade-slide-up">
          <AlertCircle className="w-5 h-5 text-purple-500" />
          Reports & Issues
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Reports"
            value={mockData.reports.total}
            icon={<AlertCircle />}
            color="warning"
          />
          <MetricCard
            title="Pending"
            value={mockData.reports.pending}
            icon={<Clock />}
            color="warning"
          />
          <MetricCard
            title="Resolved"
            value={mockData.reports.resolved}
            icon={<CheckCircle />}
            color="success"
          />
          <MetricCard
            title="Rejected"
            value={mockData.reports.rejected}
            icon={<XCircle />}
            color="error"
          />
        </div>

        <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
          <h3 className="text-lg font-semibold text-white mb-4">Report Categories</h3>
          <AnimatedPieChart data={mockData.reports.categories} showLegend showPercentages />
        </div>
      </section>

      {/* Activity Heatmap */}
      <section className="mb-8">
        <div className="bg-card border border-white/10 rounded-xl p-6 animate-scale-up">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-500" />
            Ride Activity Heatmap
          </h2>
          <p className="text-sm text-white/60 mb-6">Peak ride request times by day and hour</p>
          <Heatmap data={mockData.heatmap} color="#9333ea" />
        </div>
      </section>

      {/* Recent Rides Table */}
      <section>
        <div className="bg-card border border-white/10 rounded-xl overflow-hidden animate-scale-up">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-purple-500" />
              Recent Rides
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Ride ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mockData.recentRides.map((ride, idx) => (
                  <tr
                    key={ride.id}
                    className="hover:bg-white/5 transition-colors stagger-item"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-purple-400">{ride.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <span>{ride.from}</span>
                        <span className="text-white/40">→</span>
                        <span>{ride.to}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-white/80">{ride.driver}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                          ${getStatusColor(ride.status)}
                        `}
                      >
                        {getStatusIcon(ride.status)}
                        {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-white/60">{ride.time}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AnalyticsLayout>
  );
}
