"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, Car, AlertTriangle, CheckCircle, Clock, TrendingUp, 
  MessageSquare, FileText, Shield, Activity, Eye, UserCheck,
  Ban, Calendar, DollarSign, MapPin, Star
} from "lucide-react";
import { 
  AnimatedLineChart, 
  AnimatedBarChart, 
  StatCardWithTrend, 
  DonutChart, 
  QuickStatsGrid,
  ActivityTimeline 
} from "@/components/admin/AdminCharts";
import { Badge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/ui/tabs";

// ============================================================================
// ADMIN DASHBOARD PAGE
// ============================================================================

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("week");

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Mock data - replace with real API calls
  const quickStats = [
    {
      icon: <Users />,
      label: "Total Users",
      value: "2,547",
      trend: 12.5,
      variant: "success" as const,
    },
    {
      icon: <Car />,
      label: "Active Rides",
      value: "143",
      trend: -3.2,
      variant: "info" as const,
    },
    {
      icon: <AlertTriangle />,
      label: "Pending Reports",
      value: "23",
      trend: 8.4,
      variant: "warning" as const,
    },
    {
      icon: <MessageSquare />,
      label: "Unread Messages",
      value: "67",
      trend: 15.2,
      variant: "error" as const,
    },
  ];

  const ridesByDay = [
    { label: "Mon", value: 45 },
    { label: "Tue", value: 52 },
    { label: "Wed", value: 38 },
    { label: "Thu", value: 65 },
    { label: "Fri", value: 72 },
    { label: "Sat", value: 58 },
    { label: "Sun", value: 42 },
  ];

  const topUniversities = [
    { label: "MIT", value: 524, color: "#3F51B5" },
    { label: "Stanford", value: 412, color: "#9575CD" },
    { label: "Harvard", value: 387, color: "#22C55E" },
    { label: "Berkeley", value: 295, color: "#F59E0B" },
    { label: "Yale", value: 268, color: "#EF4444" },
  ];

  const rideStatusData = [
    { label: "Completed", value: 1245, color: "#22C55E" },
    { label: "Active", value: 143, color: "#3F51B5" },
    { label: "Cancelled", value: 89, color: "#EF4444" },
    { label: "Pending", value: 56, color: "#F59E0B" },
  ];

  const recentActivity = [
    {
      id: "1",
      title: "New ride created",
      description: "John Doe created a ride from MIT to Harvard",
      timestamp: "2 min ago",
      type: "info" as const,
      icon: <Car className="w-4 h-4" />,
    },
    {
      id: "2",
      title: "Report resolved",
      description: "Report #1234 has been resolved by Admin Sarah",
      timestamp: "15 min ago",
      type: "success" as const,
    },
    {
      id: "3",
      title: "New user registered",
      description: "Alice Smith (@mit.edu) joined the platform",
      timestamp: "1 hour ago",
      type: "success" as const,
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: "4",
      title: "Ride cancelled",
      description: "Ride #5678 was cancelled by the driver",
      timestamp: "2 hours ago",
      type: "warning" as const,
    },
    {
      id: "5",
      title: "New report submitted",
      description: "Report #1245: Inappropriate behavior reported",
      timestamp: "3 hours ago",
      type: "error" as const,
    },
  ];

  const pendingApprovals = [
    {
      id: "1",
      type: "University Verification",
      user: "Emma Wilson",
      email: "emma@stanford.edu",
      status: "pending",
      date: "2024-01-25",
    },
    {
      id: "2",
      type: "Driver License",
      user: "Michael Chen",
      email: "michael@mit.edu",
      status: "pending",
      date: "2024-01-25",
    },
    {
      id: "3",
      type: "ID Verification",
      user: "Sarah Johnson",
      email: "sarah@harvard.edu",
      status: "pending",
      date: "2024-01-24",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 space-y-6 relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
      </div>
      {/* Header */}
      <div className="animate-slide-in-down">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
        </div>
        <p className="text-white/60">
          Monitor and manage your Campus Ride platform
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 animate-fade-slide-up" style={{ animationDelay: "100ms" }}>
        {(["day", "week", "month", "year"] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-300
              ${
                timeRange === range
                  ? "bg-primary text-white shadow-glow"
                  : "bg-card/50 text-white/60 hover:bg-card/70 hover:text-white"
              }
            `}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={quickStats} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rides Over Time */}
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-scale-up hover:border-white/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Rides This Week</h3>
              <p className="text-sm text-white/60">Daily ride activity</p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <AnimatedLineChart data={ridesByDay} height={200} color="#3F51B5" />
        </div>

        {/* Top Universities */}
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-scale-up hover:border-white/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Top Universities</h3>
              <p className="text-sm text-white/60">By active users</p>
            </div>
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <AnimatedBarChart data={topUniversities} showValues />
        </div>

        {/* Ride Status Distribution */}
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-scale-up hover:border-white/20 transition-all duration-300">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Ride Status</h3>
            <p className="text-sm text-white/60">Current distribution</p>
          </div>
          <DonutChart
            data={rideStatusData}
            size={220}
            thickness={35}
            centerText="1,533"
            centerSubtext="Total Rides"
            showLegend
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-scale-up hover:border-white/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
              <p className="text-sm text-white/60">Latest platform events</p>
            </div>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-custom pr-2">
            <ActivityTimeline items={recentActivity} />
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-fade-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Pending Approvals</h3>
            <p className="text-sm text-white/60">Verification requests requiring action</p>
          </div>
          <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
            {pendingApprovals.length} Pending
          </Badge>
        </div>

        <div className="space-y-3">
          {pendingApprovals.map((approval, idx) => (
            <div
              key={approval.id}
              className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-background/70 transition-all duration-300 stagger-item"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{approval.user}</div>
                  <div className="text-sm text-white/60">{approval.type}</div>
                  <div className="text-xs text-white/40">{approval.email}</div>
                </div>
                <div className="text-sm text-white/40">{approval.date}</div>
              </div>
              <div className="flex gap-2 ml-4">
                <button className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105">
                  Approve
                </button>
                <button className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          View All Pending Approvals →
        </button>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card/50 backdrop-blur-sm border border-green-500/20 rounded-xl p-4 animate-fade-slide-up">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-sm text-white/60">System Status</div>
              <div className="font-semibold text-green-500">Operational</div>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4 animate-fade-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm text-white/60">Uptime</div>
              <div className="font-semibold text-blue-500">99.9%</div>
            </div>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4 animate-fade-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-sm text-white/60">Revenue (MTD)</div>
              <div className="font-semibold text-purple-500">$12,547</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
