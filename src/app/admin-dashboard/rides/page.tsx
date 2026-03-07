"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Search,
  MapPin,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Eye,
  Edit3,
  Trash2,
  MoreVertical,
  Calendar,
  TrendingUp,
  Download,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type RideStatus = "all" | "active" | "completed" | "cancelled";
type SortKey = "date" | "driver" | "status" | "passengers" | "earnings";

type RideRow = {
  id: string;
  driver: string;
  from: string;
  to: string;
  date: Date;
  status: "active" | "completed" | "cancelled";
  passengers: number;
  maxPassengers: number;
  earnings: number;
  university: "FAST" | "NED" | "KARACHI" | "OTHER";
  universityId: string;
};

const PAGE_SIZE = 10;

function toDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input?.toDate === "function") return input.toDate();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUniversity(value: any): RideRow["university"] {
  const uni = String(value || "").trim().toLowerCase();
  if (uni.includes("fast")) return "FAST";
  if (uni.includes("ned")) return "NED";
  if (uni.includes("karachi") || uni.includes("ku")) return "KARACHI";
  return "OTHER";
}

function normalizeRideStatus(value: any): RideRow["status"] {
  const status = String(value || "").toLowerCase();
  if (["completed", "finished"].includes(status)) return "completed";
  if (["cancelled", "canceled", "rejected", "declined", "expired"].includes(status)) return "cancelled";
  return "active";
}

function toRideRow(raw: any): RideRow {
  const passengers =
    Number(raw?.seatsBooked) ||
    Number(raw?.bookedSeats) ||
    Number(raw?.totalPassengersServed) ||
    Number(raw?.passengersServed) ||
    Number(raw?.confirmedCount) ||
    Number(raw?.acceptedCount) ||
    (Array.isArray(raw?.confirmedPassengers) ? raw.confirmedPassengers.length : 0) ||
    0;

  const availableSeats = Number(raw?.availableSeats) || 0;
  const seats = Number(raw?.seats) || Number(raw?.totalSeats) || 0;
  const maxPassengers = seats > 0 ? seats : Math.max(passengers + availableSeats, passengers);

  const pricePerSeat = Number(raw?.pricePerSeat || raw?.price || 0);
  const earnings =
    Number(raw?.totalEarnings || 0) ||
    Number(raw?.earnings?.total || 0) ||
    Number(raw?.driverEarnings || 0) ||
    Number(raw?.analytics?.driverEarnings || 0) ||
    (pricePerSeat > 0 ? pricePerSeat * passengers : 0);

  const university = normalizeUniversity(raw?.university || raw?.universityId);
  const universityId = String((raw?.universityId || raw?.university || "").toLowerCase());

  return {
    id: String(raw?.id || ""),
    driver:
      raw?.driverName ||
      raw?.rideProviderName ||
      raw?.driverInfo?.fullName ||
      raw?.driverInfo?.name ||
      raw?.driverDetails?.fullName ||
      raw?.driver?.fullName ||
      raw?.driver?.name ||
      "Unknown Driver",
    from: String(raw?.from || raw?.origin || "Unknown"),
    to: String(raw?.to || raw?.destination || "Unknown"),
    date: toDate(raw?.departureTime || raw?.createdAt) || new Date(0),
    status: normalizeRideStatus(raw?.status),
    passengers,
    maxPassengers,
    earnings,
    university,
    universityId,
  };
}

export default function AdminRidesPage() {
  const analytics = useAdminAnalytics();
  const [rows, setRows] = useState<RideRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<RideStatus>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
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

      const response = await fetch(`/api/admin/rides?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to load rides");

      const mapped = (Array.isArray(payload?.rides) ? payload.rides : []).map(toRideRow);
      setRows(mapped);
      setCurrentPage(1);
    } catch (e: any) {
      setError(e?.message || "Failed to load rides");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [filterUniversity]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        r.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.to.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      const matchesUniversity =
        filterUniversity === "all" ||
        (filterUniversity === "fast" && r.university === "FAST") ||
        (filterUniversity === "ned" && r.university === "NED") ||
        (filterUniversity === "karachi" && r.university === "KARACHI");

      return matchesSearch && matchesStatus && matchesUniversity;
    });
  }, [rows, searchTerm, filterStatus, filterUniversity]);

  const sortedRides = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];

      if (sortBy === "date") {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRides.length / PAGE_SIZE));
  const paginatedRides = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRides.slice(start, start + PAGE_SIZE);
  }, [sortedRides, currentPage]);

  const updateRide = useCallback(async (ride: RideRow, updates: Record<string, any>) => {
    try {
      setActionLoadingId(ride.id);
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("Admin authentication required");
      const token = await authUser.getIdToken();

      const response = await fetch("/api/admin/rides", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId: ride.id, universityId: ride.universityId, updates }),
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

  const deleteRide = useCallback(async () => {
    setError('Deletion is disabled in admin dashboard. Delete data only from Firebase project console.');
  }, []);

  const stats = {
    total: analytics.combined.rides.total,
    active: analytics.combined.rides.active,
    completed: analytics.combined.rides.completed,
    cancelled: analytics.combined.rides.cancelled,
  };

  if (analytics.loading || loadingRows) {
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Car className="w-10 h-10 text-primary" />
              Rides Management
            </h1>
            <p className="text-slate-400">Real rides from Firebase</p>
          </div>
          <button onClick={() => void fetchRows()} className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Rides" value={stats.total} color="blue" icon={Car} />
        <StatBox label="Active" value={stats.active} color="green" icon={TrendingUp} />
        <StatBox label="Completed" value={stats.completed} color="purple" icon={CheckCircle} />
        <StatBox label="Cancelled" value={stats.cancelled} color="red" icon={XCircle} />
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Rides</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Driver, from, to..."
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
                setFilterStatus(e.target.value as RideStatus);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Rides</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
              <option value="cancelled">Cancelled Only</option>
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
              {paginatedRides.map((ride) => (
                <tr
                  key={ride.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/30 transition-all ${selectedRideId === ride.id ? "bg-slate-800/40" : ""}`}
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{ride.driver}</p>
                    <p className="text-sm text-slate-400">{ride.university}</p>
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
                    {ride.date.getTime() > 0
                      ? `${ride.date.toLocaleDateString()} ${ride.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <ActionButton icon={Eye} title="View" onClick={() => setSelectedRideId(ride.id)} />
                      <ActionButton
                        icon={Edit3}
                        title={ride.status === "completed" ? "Set Active" : "Mark Completed"}
                        disabled={actionLoadingId === ride.id}
                        onClick={() => void updateRide(ride, { status: ride.status === "completed" ? "active" : "completed" })}
                      />
                      <ActionButton
                        icon={Trash2}
                        title="Delete disabled (Firebase console only)"
                        className="hover:text-red-400"
                        disabled
                        onClick={() => void deleteRide(ride)}
                      />
                      <ActionButton
                        icon={MoreVertical}
                        title={ride.status === "cancelled" ? "Set Active" : "Cancel Ride"}
                        disabled={actionLoadingId === ride.id}
                        onClick={() => void updateRide(ride, { status: ride.status === "cancelled" ? "active" : "cancelled" })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRides.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-400" colSpan={7}>No rides found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">Showing {paginatedRides.length} of {sortedRides.length} rides</p>
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
