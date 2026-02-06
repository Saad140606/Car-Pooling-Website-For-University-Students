"use client";

import React, { useState, useMemo } from "react";
import {
  Car,
  Search,
  MapPin,
  Clock,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Edit3,
  Trash2,
  MoreVertical,
  Calendar,
  TrendingUp,
  Download,
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type RideStatus = "all" | "active" | "completed" | "cancelled";
type SortKey = "date" | "driver" | "status" | "passengers" | "earnings";

export default function AdminRidesPage() {
  const analytics = useAdminAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<RideStatus>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const mockRides = useMemo(() => {
    const rides = [
      {
        id: "ride1",
        driver: "Ahmed Hassan",
        from: "FAST Main Gate",
        to: "Karachi Airport",
        date: new Date(2026, 1, 4, 14, 30),
        status: "active" as const,
        passengers: 3,
        maxPassengers: 4,
        earnings: 2500,
        university: "FAST",
        requests: 5,
      },
      {
        id: "ride2",
        driver: "Fatima Khan",
        from: "NED University",
        to: "Clifton",
        date: new Date(2026, 1, 3, 10, 15),
        status: "completed" as const,
        passengers: 2,
        maxPassengers: 3,
        earnings: 1800,
        university: "NED",
        requests: 2,
      },
      {
        id: "ride3",
        driver: "Ali Raza",
        from: "FAST Library",
        to: "Gulshan",
        date: new Date(2026, 1, 2, 16, 45),
        status: "cancelled" as const,
        passengers: 0,
        maxPassengers: 4,
        earnings: 0,
        university: "FAST",
        requests: 3,
      },
    ];

    return rides.filter((r) => {
      const matchesSearch =
        r.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.to.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      const matchesUniversity =
        filterUniversity === "all" ||
        (filterUniversity === "fast" && r.university === "FAST") ||
        (filterUniversity === "ned" && r.university === "NED");

      return matchesSearch && matchesStatus && matchesUniversity;
    });
  }, [searchTerm, filterStatus, filterUniversity]);

  const sortedRides = useMemo(() => {
    return [...mockRides].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === "date") {
        aVal = (a.date as any).getTime();
        bVal = (b.date as any).getTime();
      } else if (typeof aVal === "string") {
        aVal = (aVal as string).toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [mockRides, sortBy, sortOrder]);

  const stats = {
    total: analytics.combined.rides.total,
    active: analytics.combined.rides.active,
    completed: analytics.combined.rides.completed,
    cancelled: analytics.combined.rides.cancelled,
  };

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading rides...</p>
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
              <Car className="w-10 h-10 text-primary" />
              Rides Management
            </h1>
            <p className="text-slate-400">Monitor and manage all platform rides</p>
          </div>
          <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Rides" value={stats.total} color="blue" icon={Car} />
        <StatBox label="Active" value={stats.active} color="green" icon={TrendingUp} />
        <StatBox label="Completed" value={stats.completed} color="purple" icon={CheckCircle} />
        <StatBox label="Cancelled" value={stats.cancelled} color="red" icon={XCircle} />
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Rides</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Driver, from, to..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as RideStatus)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Rides</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>

          {/* University Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">University</label>
            <select
              value={filterUniversity}
              onChange={(e) => setFilterUniversity(e.target.value as "all" | "fast" | "ned" | "karachi")}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Universities</option>
              <option value="fast">FAST Only</option>
              <option value="ned">NED Only</option>
              <option value="karachi">Karachi Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rides Table */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Driver</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Route</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Passengers</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Earnings</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRides.map((ride) => (
                <tr
                  key={ride.id}
                  className="border-b border-slate-800 hover:bg-slate-800/30 transition-all"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{ride.driver}</p>
                    <p className="text-sm text-slate-400">
                      {ride.university === "FAST" ? "🔵 FAST" : "🟢 NED"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{ride.from}</p>
                        <p className="text-xs text-slate-400">{ride.to}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${
                        ride.status === "active"
                          ? "bg-green-500/20 text-green-300"
                          : ride.status === "completed"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {ride.status === "active" && <CheckCircle className="w-3 h-3" />}
                      {ride.status === "completed" && <CheckCircle className="w-3 h-3" />}
                      {ride.status === "cancelled" && <XCircle className="w-3 h-3" />}
                      {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-white font-medium">
                        {ride.passengers}/{ride.maxPassengers}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Rs. {ride.earnings.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {ride.date.toLocaleDateString()} {ride.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <ActionButton icon={Eye} title="View" />
                      <ActionButton icon={Edit3} title="Edit" />
                      <ActionButton icon={Trash2} title="Delete" className="hover:text-red-400" />
                      <ActionButton icon={MoreVertical} title="More" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">Showing {sortedRides.length} rides</p>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all text-sm">
              Previous
            </button>
            <button className="px-3 py-2 bg-primary text-white rounded-lg transition-all text-sm">
              1
            </button>
            <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
}) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
  };

  return (
    <div className={`${colors[color as keyof typeof colors]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8 opacity-50" />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  title,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      className={`p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-white ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
