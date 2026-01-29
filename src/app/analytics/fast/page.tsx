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

// Mock data - replace with real data from Firebase
const mockData = {
  users: {
    total: 2547,
    active: 1823,
    newSignups: 234,
    growth: 12.5,
    weeklyData: [
      { label: "Mon", value: 320 },
      { label: "Tue", value: 380 },
      { label: "Wed", value: 410 },
      { label: "Thu", value: 390 },
      { label: "Fri", value: 450 },
      { label: "Sat", value: 380 },
      { label: "Sun", value: 340 },
    ],
  },
  rides: {
    requested: 1456,
    completed: 1234,
    pending: 98,
    cancelled: 124,
    completionRate: 84.7,
    distribution: [
      { label: "Completed", value: 1234, color: "#10b981" },
      { label: "Pending", value: 98, color: "#f59e0b" },
      { label: "Cancelled", value: 124, color: "#ef4444" },
    ],
  },
  engagement: {
    pageViews: 15420,
    avgSessionDuration: "4m 32s",
    popularPages: [
      { page: "Dashboard", views: 4523 },
      { page: "Find Rides", views: 3821 },
      { page: "My Rides", views: 2940 },
      { page: "Profile", views: 1876 },
      { page: "Chat", views: 1260 },
    ],
    weeklyViews: [
      { label: "Mon", value: 2100 },
      { label: "Tue", value: 2300 },
      { label: "Wed", value: 2450 },
      { label: "Thu", value: 2200 },
      { label: "Fri", value: 2800 },
      { label: "Sat", value: 1870 },
      { label: "Sun", value: 1700 },
    ],
  },
  reports: {
    total: 47,
    pending: 12,
    resolved: 32,
    rejected: 3,
    categories: [
      { label: "Safety Issues", value: 18, color: "#ef4444" },
      { label: "Payment", value: 12, color: "#f59e0b" },
      { label: "User Behavior", value: 9, color: "#3b82f6" },
      { label: "Technical", value: 5, color: "#8b5cf6" },
      { label: "Other", value: 3, color: "#6b7280" },
    ],
  },
  heatmap: [
    { day: "Mon", hour: 8, value: 45 },
    { day: "Mon", hour: 9, value: 52 },
    { day: "Mon", hour: 17, value: 68 },
    { day: "Mon", hour: 18, value: 72 },
    { day: "Tue", hour: 8, value: 48 },
    { day: "Tue", hour: 9, value: 55 },
    { day: "Tue", hour: 17, value: 65 },
    { day: "Tue", hour: 18, value: 70 },
    { day: "Wed", hour: 8, value: 50 },
    { day: "Wed", hour: 9, value: 58 },
    { day: "Wed", hour: 17, value: 70 },
    { day: "Wed", hour: 18, value: 75 },
    { day: "Thu", hour: 8, value: 47 },
    { day: "Thu", hour: 9, value: 53 },
    { day: "Thu", hour: 17, value: 67 },
    { day: "Thu", hour: 18, value: 71 },
    { day: "Fri", hour: 8, value: 52 },
    { day: "Fri", hour: 9, value: 60 },
    { day: "Fri", hour: 17, value: 75 },
    { day: "Fri", hour: 18, value: 80 },
    { day: "Sat", hour: 10, value: 35 },
    { day: "Sat", hour: 14, value: 42 },
    { day: "Sat", hour: 20, value: 38 },
    { day: "Sun", hour: 10, value: 30 },
    { day: "Sun", hour: 14, value: 38 },
    { day: "Sun", hour: 20, value: 35 },
  ],
  recentRides: [
    {
      id: "R001",
      from: "FAST Campus",
      to: "Saddar",
      driver: "Ahmed Khan",
      status: "completed",
      time: "2 hours ago",
    },
    {
      id: "R002",
      from: "Karachi",
      to: "FAST Campus",
      driver: "Sara Ahmed",
      status: "active",
      time: "30 mins ago",
    },
    {
      id: "R003",
      from: "FAST Campus",
      to: "Clifton",
      driver: "Ali Raza",
      status: "pending",
      time: "1 hour ago",
    },
    {
      id: "R004",
      from: "Gulshan",
      to: "FAST Campus",
      driver: "Fatima Ali",
      status: "completed",
      time: "3 hours ago",
    },
    {
      id: "R005",
      from: "FAST Campus",
      to: "DHA",
      driver: "Hassan Sheikh",
      status: "cancelled",
      time: "5 hours ago",
    },
  ],
};

export default function FASTAnalyticsPage() {
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
    // Simulate data refresh
    setTimeout(() => setIsLoading(false), 1500);
  };

  const handleExport = () => {
    console.log("Exporting data...");
    // Implement export functionality
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
      title="FAST Analytics Dashboard"
      portalName="FAST"
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
          <Users className="w-5 h-5 text-primary" />
          User Analytics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Users"
            value={mockData.users.total}
            icon={<Users />}
            color="primary"
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
            trend={18.3}
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
            color="#3F51B5"
            showGrid
            showDots
          />
        </div>
      </section>

      {/* Ride Analytics */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 animate-fade-slide-up">
          <Car className="w-5 h-5 text-primary" />
          Ride Analytics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Requests"
            value={mockData.rides.requested}
            icon={<Car />}
            color="primary"
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
          <Eye className="w-5 h-5 text-primary" />
          Views & Engagement
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Page Views"
            value={mockData.engagement.pageViews}
            icon={<Eye />}
            color="info"
            trend={8.7}
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
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
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
          <AlertCircle className="w-5 h-5 text-primary" />
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
            <MapPin className="w-5 h-5 text-primary" />
            Ride Activity Heatmap
          </h2>
          <p className="text-sm text-white/60 mb-6">Peak ride request times by day and hour</p>
          <Heatmap data={mockData.heatmap} color="#3F51B5" />
        </div>
      </section>

      {/* Recent Rides Table */}
      <section>
        <div className="bg-card border border-white/10 rounded-xl overflow-hidden animate-scale-up">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
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
                      <span className="text-sm font-mono text-primary">{ride.id}</span>
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
