"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Mail,
  Star,
  TrendingUp,
  Download,
  Eye,
  Ban,
  Edit3,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type SortKey = "name" | "email" | "university" | "joinDate" | "rides" | "rating";
type FilterStatus = "all" | "verified" | "unverified" | "active" | "inactive";

type UserRow = {
  id: string;
  name: string;
  email: string;
  university: "FAST" | "NED" | "KARACHI" | "OTHER";
  joinDate: Date;
  verified: boolean;
  active: boolean;
  rides: number;
  rating: number;
  reviews: number;
  status: string;
};

const PAGE_SIZE = 10;

function toDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input?.toDate === "function") return input.toDate();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUniversity(value: any): UserRow["university"] {
  const uni = String(value || "").trim().toLowerCase();
  if (uni.includes("fast")) return "FAST";
  if (uni.includes("ned")) return "NED";
  if (uni.includes("karachi") || uni.includes("ku")) return "KARACHI";
  return "OTHER";
}

function toUserRow(raw: any): UserRow {
  const university = normalizeUniversity(raw?.university || raw?.universityId || raw?.selectedUni);
  const name =
    raw?.fullName ||
    raw?.displayName ||
    raw?.name ||
    [raw?.firstName, raw?.lastName].filter(Boolean).join(" ") ||
    "Unknown User";
  const email = String(raw?.email || raw?.universityEmail || raw?.studentEmail || "No email");
  const verified = Boolean(raw?.universityEmailVerified || raw?.emailVerified || raw?.verified);
  const status = String(raw?.status || "active").toLowerCase();
  const active = !["inactive", "suspended", "banned", "blocked"].includes(status);
  const joinDate = toDate(raw?.createdAt || raw?.joinedAt) || new Date(0);

  const rides =
    Number(raw?.totalRides) ||
    Number(raw?.ridesCount) ||
    Number(raw?.stats?.rides) ||
    0;

  const rating = Number(raw?.averageRating || raw?.rating || 0) || 0;
  const reviews = Number(raw?.totalReviews || raw?.reviewsCount || 0) || 0;

  return {
    id: String(raw?.id || ""),
    name,
    email,
    university,
    joinDate,
    verified,
    active,
    rides,
    rating,
    reviews,
    status,
  };
}

export default function AdminUsersPage() {
  const analytics = useAdminAnalytics();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [sortBy, setSortBy] = useState<SortKey>("joinDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoadingRows(true);
      setError(null);
      const user = getAuth().currentUser;
      if (!user) throw new Error("Admin authentication required");
      const token = await user.getIdToken();

      const params = new URLSearchParams({ limit: "1000", offset: "0" });
      if (filterUniversity !== "all") params.set("universityId", filterUniversity);

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to load users");

      const mapped = (Array.isArray(payload?.users) ? payload.users : []).map(toUserRow);
      setRows(mapped);
      setCurrentPage(1);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [filterUniversity]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const filteredUsers = useMemo(() => {
    return rows.filter((u) => {
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
        (filterUniversity === "ned" && u.university === "NED") ||
        (filterUniversity === "karachi" && u.university === "KARACHI");

      return matchesSearch && matchesStatus && matchesUniversity;
    });
  }, [rows, searchTerm, filterStatus, filterUniversity]);

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];

      if (sortBy === "joinDate") {
        aVal = a.joinDate.getTime();
        bVal = b.joinDate.getTime();
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredUsers, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  const runUserAction = useCallback(async (user: UserRow, updates: Record<string, any>) => {
    try {
      setActionLoadingId(user.id);
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("Admin authentication required");
      const token = await authUser.getIdToken();

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, updates }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Action failed");

      await fetchRows();
    } catch (e: any) {
      setError(e?.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchRows]);

  if (analytics.loading || loadingRows) {
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Users className="w-10 h-10 text-primary" />
              Users Management
            </h1>
            <p className="text-slate-400">Real users from Firebase</p>
          </div>
          <button onClick={() => void fetchRows()} className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatBox label="Total Users" value={analytics.combined.users.total} icon={Users} color="blue" />
        <StatBox label="Verified" value={analytics.combined.users.verified} icon={CheckCircle} color="green" />
        <StatBox label="University Verified" value={analytics.combined.users.universityVerified} icon={CheckCircle} color="green" />
        <StatBox label="Unverified" value={analytics.combined.users.unverified} icon={AlertCircle} color="yellow" />
        <StatBox label="Active Today" value={analytics.combined.users.active} icon={TrendingUp} color="purple" />
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Users</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Name, email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as FilterStatus);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Users</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified Only</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

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

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

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
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/30 transition-all ${selectedUserId === user.id ? "bg-slate-800/40" : ""}`}
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
                          : user.university === "NED"
                            ? "bg-green-500/20 text-green-300"
                            : user.university === "KARACHI"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-slate-500/20 text-slate-300"
                      }`}
                    >
                      {user.university}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-200">
                      {user.verified ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-yellow-400" />}
                      {user.verified ? "Verified" : "Pending"}
                      {!user.active && <span className="text-red-400">• Suspended</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{user.rides}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-white font-medium">{user.rating.toFixed(1)}</span>
                      <span className="text-slate-400 text-sm">({user.reviews})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {user.joinDate.getTime() > 0 ? user.joinDate.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <ActionButton icon={Eye} title="View" onClick={() => setSelectedUserId(user.id)} />
                      <ActionButton
                        icon={Edit3}
                        title={user.verified ? "Mark Unverified" : "Mark Verified"}
                        disabled={actionLoadingId === user.id}
                        onClick={() => void runUserAction(user, { universityEmailVerified: !user.verified, emailVerified: !user.verified })}
                      />
                      <ActionButton
                        icon={Ban}
                        title={user.active ? "Suspend User" : "Activate User"}
                        className="hover:text-red-400"
                        disabled={actionLoadingId === user.id}
                        onClick={() => void runUserAction(user, { status: user.active ? "suspended" : "active" })}
                      />
                      <ActionButton icon={MoreVertical} title="Select" onClick={() => setSelectedUserId(user.id)} />
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedUsers.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-400" colSpan={7}>No users found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">Showing {paginatedUsers.length} of {sortedUsers.length} users</p>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg transition-all text-sm"
            >
              Previous
            </button>
            <button className="px-3 py-2 bg-primary text-white rounded-lg transition-all text-sm">{currentPage}</button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg transition-all text-sm"
            >
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
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-white disabled:opacity-40 ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
