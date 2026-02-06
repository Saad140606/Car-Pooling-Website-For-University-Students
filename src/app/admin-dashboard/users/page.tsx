"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Star,
  TrendingUp,
  Download,
  Eye,
  Ban,
  Edit3,
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type SortKey = "name" | "email" | "university" | "joinDate" | "rides" | "rating";
type FilterStatus = "all" | "verified" | "unverified" | "active" | "inactive";

export default function AdminUsersPage() {
  const analytics = useAdminAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [sortBy, setSortBy] = useState<SortKey>("joinDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Mock user data - in real app, fetch from Firestore
  const mockUsers = useMemo(() => {
    const users = [
      {
        id: "user1",
        name: "Ahmed Hassan",
        email: "ahmed@fast.edu.pk",
        university: "FAST",
        phone: "+923001234567",
        joinDate: new Date(2025, 8, 15),
        verified: true,
        active: true,
        rides: 12,
        rating: 4.8,
        reviews: 15,
      },
      {
        id: "user2",
        name: "Fatima Khan",
        email: "fatima@ned.edu.pk",
        university: "NED",
        phone: "+923009876543",
        joinDate: new Date(2025, 10, 22),
        verified: false,
        active: true,
        rides: 3,
        rating: 4.2,
        reviews: 4,
      },
      {
        id: "user3",
        name: "Ali Raza",
        email: "ali.raza@fast.edu.pk",
        university: "FAST",
        phone: "+923005555555",
        joinDate: new Date(2025, 7, 10),
        verified: true,
        active: false,
        rides: 8,
        rating: 4.5,
        reviews: 9,
      },
    ];

    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "verified" && u.verified) ||
        (filterStatus === "unverified" && !u.verified) ||
        (filterStatus === "active" && u.active) ||
        (filterStatus === "inactive" && !u.active);

      const matchesUniversity =
        filterUniversity === "all" ||
        (filterUniversity === "fast" && u.university === "FAST") ||
        (filterUniversity === "ned" && u.university === "NED");

      return matchesSearch && matchesStatus && matchesUniversity;
    });
  }, [searchTerm, filterStatus, filterUniversity]);

  const sortedUsers = useMemo(() => {
    const sorted = [...mockUsers].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [mockUsers, sortBy, sortOrder]);

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading users...</p>
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
              <Users className="w-10 h-10 text-primary" />
              Users Management
            </h1>
            <p className="text-slate-400">Manage and monitor all platform users</p>
          </div>
          <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox
          label="Total Users"
          value={analytics.combined.users.total}
          icon={Users}
          color="blue"
        />
        <StatBox
          label="Verified"
          value={analytics.combined.users.verified}
          icon={CheckCircle}
          color="green"
        />
        <StatBox
          label="Unverified"
          value={analytics.combined.users.unverified}
          icon={AlertCircle}
          color="yellow"
        />
        <StatBox
          label="Active Today"
          value={analytics.combined.users.active}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Users</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Name, email..."
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
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Users</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified Only</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
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

      {/* Users Table */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  <button
                    onClick={() => {
                      setSortBy("university");
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }}
                    className="hover:text-white transition-all"
                  >
                    University
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  <button
                    onClick={() => {
                      setSortBy("rides");
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }}
                    className="hover:text-white transition-all"
                  >
                    Rides
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Rating</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Joined</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user, idx) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-800 hover:bg-slate-800/30 transition-all"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-sm text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.university === "FAST"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-green-500/20 text-green-300"
                      }`}
                    >
                      {user.university}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.verified ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                      )}
                      <span className="text-sm">{user.verified ? "Verified" : "Pending"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{user.rides}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-white font-medium">{user.rating}</span>
                      <span className="text-slate-400 text-sm">({user.reviews})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {user.joinDate.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <ActionButton icon={Eye} title="View" />
                      <ActionButton icon={Edit3} title="Edit" />
                      <ActionButton icon={Ban} title="Ban" className="hover:text-red-400" />
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
          <p className="text-sm text-slate-400">Showing {sortedUsers.length} users</p>
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
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
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
