"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Users,
  MapPin,
  DollarSign,
  Eye,
  Edit3,
  Trash2,
  MoreVertical,
  Download,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type BookingStatus = "all" | "confirmed" | "pending" | "cancelled";

type BookingRow = {
  id: string;
  bookingId: string;
  passenger: string;
  driver: string;
  date: Date;
  status: "confirmed" | "pending" | "cancelled";
  seats: number;
  fare: number;
  university: "FAST" | "NED" | "KARACHI" | "OTHER";
  universityId: string;
  from: string;
  to: string;
};

const PAGE_SIZE = 10;

function toDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input?.toDate === "function") return input.toDate();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUniversity(value: any): BookingRow["university"] {
  const uni = String(value || "").trim().toLowerCase();
  if (uni.includes("fast")) return "FAST";
  if (uni.includes("ned")) return "NED";
  if (uni.includes("karachi") || uni.includes("ku")) return "KARACHI";
  return "OTHER";
}

function normalizeBookingStatus(value: any): BookingRow["status"] {
  const status = String(value || "").toLowerCase();
  if (["confirmed", "accepted", "completed", "booked"].includes(status)) return "confirmed";
  if (["cancelled", "canceled", "rejected", "declined", "expired"].includes(status)) return "cancelled";
  return "pending";
}

function toBookingRow(raw: any): BookingRow {
  const seats = Number(raw?.seats || raw?.seatsBooked || raw?.requestedSeats || 1) || 1;
  const fare =
    Number(raw?.totalFare || raw?.fare || raw?.amount || raw?.amountPaid || 0) ||
    (Number(raw?.pricePerSeat || raw?.price || raw?.ride?.pricePerSeat || raw?.ride?.price || 0) * seats);

  const university = normalizeUniversity(raw?.university || raw?.universityId || raw?.rideUniversity);
  const universityId = String((raw?.universityId || raw?.university || raw?.rideUniversity || "").toLowerCase());

  return {
    id: String(raw?.id || ""),
    bookingId: String(raw?.bookingId || raw?.id || "").toUpperCase(),
    passenger:
      raw?.passengerName ||
      raw?.passengerDetails?.fullName ||
      raw?.passenger?.fullName ||
      raw?.passengerEmail ||
      "Unknown Passenger",
    driver:
      raw?.driverName ||
      raw?.rideProviderName ||
      raw?.rideData?.driverInfo?.fullName ||
      raw?.rideData?.driverInfo?.name ||
      raw?.ride?.driverInfo?.fullName ||
      raw?.ride?.driverInfo?.name ||
      raw?.driver?.fullName ||
      raw?.providerName ||
      "Unknown Driver",
    date: toDate(raw?.createdAt || raw?.updatedAt || raw?.departureTime) || new Date(0),
    status: normalizeBookingStatus(raw?.status),
    seats,
    fare,
    university,
    universityId,
    from: String(raw?.from || raw?.rideFrom || raw?.ride?.from || "Unknown"),
    to: String(raw?.to || raw?.rideTo || raw?.ride?.to || "Unknown"),
  };
}

export default function AdminBookingsPage() {
  const analytics = useAdminAnalytics();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<BookingStatus>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [sortBy, setSortBy] = useState<"date" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
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

      const response = await fetch(`/api/admin/bookings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to load bookings");

      const mapped = (Array.isArray(payload?.bookings) ? payload.bookings : []).map(toBookingRow);
      setRows(mapped);
      setCurrentPage(1);
    } catch (e: any) {
      setError(e?.message || "Failed to load bookings");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }, [filterUniversity]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    return rows.filter((b) => {
      const matchesSearch =
        b.passenger.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.bookingId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "all" || b.status === filterStatus;
      const matchesUniversity =
        filterUniversity === "all" ||
        (filterUniversity === "fast" && b.university === "FAST") ||
        (filterUniversity === "ned" && b.university === "NED") ||
        (filterUniversity === "karachi" && b.university === "KARACHI");

      return matchesSearch && matchesStatus && matchesUniversity;
    });
  }, [rows, searchTerm, filterStatus, filterUniversity]);

  const sortedBookings = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortBy === "date") {
        const aTime = a.date.getTime();
        const bTime = b.date.getTime();
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      }
      return sortOrder === "asc"
        ? a.status.localeCompare(b.status)
        : b.status.localeCompare(a.status);
    });
  }, [filteredRows, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / PAGE_SIZE));
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedBookings.slice(start, start + PAGE_SIZE);
  }, [sortedBookings, currentPage]);

  const updateBooking = useCallback(async (booking: BookingRow, updates: Record<string, any>) => {
    try {
      setActionLoadingId(booking.id);
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("Admin authentication required");
      const token = await authUser.getIdToken();

      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: booking.id, universityId: booking.universityId, updates }),
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

  const deleteBooking = useCallback(async (booking: BookingRow) => {
    try {
      setActionLoadingId(booking.id);
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("Admin authentication required");
      const token = await authUser.getIdToken();

      const params = new URLSearchParams({ bookingId: booking.id, universityId: booking.universityId });
      const response = await fetch(`/api/admin/bookings?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Delete failed");
      await fetchRows();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchRows]);

  const stats = {
    total: analytics.combined.bookings.total,
    confirmed: analytics.combined.bookings.confirmed,
    pending: analytics.combined.bookings.pending,
    cancelled: analytics.combined.bookings.cancelled,
  };

  if (analytics.loading || loadingRows) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading bookings...</p>
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
              <FileText className="w-10 h-10 text-primary" />
              Bookings Management
            </h1>
            <p className="text-slate-400">Real bookings from Firebase</p>
          </div>
          <button onClick={() => void fetchRows()} className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Bookings" value={stats.total} color="blue" icon={FileText} />
        <StatBox label="Confirmed" value={stats.confirmed} color="green" icon={CheckCircle} />
        <StatBox label="Pending" value={stats.pending} color="yellow" icon={Clock} />
        <StatBox label="Cancelled" value={stats.cancelled} color="red" icon={XCircle} />
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Bookings</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Booking ID, passenger, driver..."
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
                setFilterStatus(e.target.value as BookingStatus);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Bookings</option>
              <option value="confirmed">Confirmed Only</option>
              <option value="pending">Pending Only</option>
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Booking ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Passenger / Driver</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Route</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Seats</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Fare</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/30 transition-all ${selectedBookingId === booking.id ? "bg-slate-800/40" : ""}`}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-bold text-primary">{booking.bookingId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-medium">{booking.passenger}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-400" />
                        <span className="text-slate-400 text-sm">{booking.driver}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{booking.from}</p>
                        <p className="text-xs text-slate-400">{booking.to}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${
                        booking.status === "confirmed"
                          ? "bg-green-500/20 text-green-300"
                          : booking.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {booking.status === "confirmed" && <CheckCircle className="w-3 h-3" />}
                      {booking.status === "pending" && <Clock className="w-3 h-3" />}
                      {booking.status === "cancelled" && <XCircle className="w-3 h-3" />}
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">{booking.seats}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Rs. {booking.fare.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {booking.date.getTime() > 0 ? booking.date.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <ActionButton icon={Eye} title="View" onClick={() => setSelectedBookingId(booking.id)} />
                      <ActionButton
                        icon={Edit3}
                        title={booking.status === "confirmed" ? "Set Pending" : "Set Confirmed"}
                        disabled={actionLoadingId === booking.id}
                        onClick={() => void updateBooking(booking, { status: booking.status === "confirmed" ? "pending" : "confirmed" })}
                      />
                      <ActionButton
                        icon={Trash2}
                        title="Delete"
                        className="hover:text-red-400"
                        disabled={actionLoadingId === booking.id}
                        onClick={() => void deleteBooking(booking)}
                      />
                      <ActionButton
                        icon={MoreVertical}
                        title={booking.status === "cancelled" ? "Set Pending" : "Cancel Booking"}
                        disabled={actionLoadingId === booking.id}
                        onClick={() => void updateBooking(booking, { status: booking.status === "cancelled" ? "pending" : "cancelled" })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedBookings.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-400" colSpan={8}>No bookings found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">Showing {paginatedBookings.length} of {sortedBookings.length} bookings</p>
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
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
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
