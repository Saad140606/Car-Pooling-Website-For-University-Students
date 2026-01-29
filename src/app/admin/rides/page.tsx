"use client";

import React, { useState, useEffect } from "react";
import {
  Car,
  Search,
  Filter,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Ban,
  Download,
  RefreshCw,
  TrendingUp,
  Navigation,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { DataGrid } from "@/components/ui/table";
import { AnimatedButton } from "@/components/AnimatedButton";
import { AnimatedModal } from "@/components/AnimatedModal";
import { Tabs } from "@/components/Tabs";

// ============================================================================
// RIDES MANAGEMENT PAGE
// ============================================================================

interface Ride {
  id: string;
  driver: {
    id: string;
    name: string;
    rating: number;
  };
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  status: "scheduled" | "active" | "completed" | "cancelled";
  bookings: number;
  distance: string;
  duration: string;
  createdAt: string;
}

export default function RidesPage() {
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [filteredRides, setFilteredRides] = useState<Ride[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: "cancel" | "view" | null;
    ride: Ride | null;
  }>({ isOpen: false, action: null, ride: null });

  useEffect(() => {
    // Simulate loading rides
    const timer = setTimeout(() => {
      const mockRides: Ride[] = [
        {
          id: "R001",
          driver: { id: "U001", name: "John Smith", rating: 4.8 },
          from: "MIT Campus",
          to: "Harvard Square",
          date: "2024-01-26",
          time: "10:00 AM",
          price: 15,
          availableSeats: 2,
          totalSeats: 4,
          status: "scheduled",
          bookings: 2,
          distance: "3.2 mi",
          duration: "12 min",
          createdAt: "2024-01-25 09:30 AM",
        },
        {
          id: "R002",
          driver: { id: "U003", name: "Michael Chen", rating: 4.9 },
          from: "Harvard University",
          to: "Boston Logan Airport",
          date: "2024-01-25",
          time: "02:00 PM",
          price: 45,
          availableSeats: 0,
          totalSeats: 3,
          status: "active",
          bookings: 3,
          distance: "8.5 mi",
          duration: "25 min",
          createdAt: "2024-01-24 03:15 PM",
        },
        {
          id: "R003",
          driver: { id: "U007", name: "Tom Anderson", rating: 4.6 },
          from: "Stanford Campus",
          to: "San Francisco Downtown",
          date: "2024-01-24",
          time: "06:30 PM",
          price: 35,
          availableSeats: 1,
          totalSeats: 4,
          status: "completed",
          bookings: 3,
          distance: "35 mi",
          duration: "45 min",
          createdAt: "2024-01-23 10:00 AM",
        },
        {
          id: "R004",
          driver: { id: "U001", name: "John Smith", rating: 4.8 },
          from: "Yale Campus",
          to: "New Haven Station",
          date: "2024-01-25",
          time: "08:00 AM",
          price: 12,
          availableSeats: 3,
          totalSeats: 3,
          status: "cancelled",
          bookings: 0,
          distance: "2.1 mi",
          duration: "8 min",
          createdAt: "2024-01-24 07:00 PM",
        },
        {
          id: "R005",
          driver: { id: "U003", name: "Michael Chen", rating: 4.9 },
          from: "Berkeley Campus",
          to: "Oakland International Airport",
          date: "2024-01-26",
          time: "12:30 PM",
          price: 40,
          availableSeats: 1,
          totalSeats: 4,
          status: "scheduled",
          bookings: 3,
          distance: "15 mi",
          duration: "30 min",
          createdAt: "2024-01-25 11:20 AM",
        },
        {
          id: "R006",
          driver: { id: "U007", name: "Tom Anderson", rating: 4.6 },
          from: "Princeton Campus",
          to: "New York City",
          date: "2024-01-27",
          time: "03:00 PM",
          price: 55,
          availableSeats: 2,
          totalSeats: 4,
          status: "scheduled",
          bookings: 2,
          distance: "52 mi",
          duration: "1h 15min",
          createdAt: "2024-01-25 02:45 PM",
        },
      ];

      setRides(mockRides);
      setFilteredRides(mockRides);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Filter rides based on tab and search
  useEffect(() => {
    let filtered = rides;

    // Filter by status tab
    if (activeTab !== "all") {
      filtered = filtered.filter((r) => r.status === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.to.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredRides(filtered);
  }, [activeTab, searchQuery, rides]);

  const handleAction = (action: "cancel" | "view", ride: Ride) => {
    setActionModal({ isOpen: true, action, ride });
  };

  const confirmCancel = () => {
    if (!actionModal.ride) return;

    const updatedRides = rides.map((r) => {
      if (r.id === actionModal.ride!.id) {
        return { ...r, status: "cancelled" as const };
      }
      return r;
    });

    setRides(updatedRides);
    setActionModal({ isOpen: false, action: null, ride: null });
  };

  const tabs = [
    { id: "all", label: "All Rides", badge: rides.length },
    { id: "scheduled", label: "Scheduled", badge: rides.filter((r) => r.status === "scheduled").length },
    { id: "active", label: "Active", badge: rides.filter((r) => r.status === "active").length },
    { id: "completed", label: "Completed", badge: rides.filter((r) => r.status === "completed").length },
    { id: "cancelled", label: "Cancelled", badge: rides.filter((r) => r.status === "cancelled").length },
  ];

  const columns = [
    {
      key: "id",
      label: "Ride ID",
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-white/80 font-semibold">{value}</span>
      ),
    },
    {
      key: "route",
      label: "Route",
      render: (_: any, row: Ride) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-3 h-3 text-green-500" />
            <span className="text-white/80 font-medium">{row.from}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="w-3 h-3 text-red-500" />
            <span className="text-white/80 font-medium">{row.to}</span>
          </div>
          <div className="text-xs text-white/40">
            {row.distance} · {row.duration}
          </div>
        </div>
      ),
    },
    {
      key: "driver",
      label: "Driver",
      sortable: true,
      render: (_: any, row: Ride) => (
        <div>
          <div className="font-medium text-white/90">{row.driver.name}</div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-yellow-500">★</span>
            <span className="text-white/60">{row.driver.rating.toFixed(1)}</span>
          </div>
        </div>
      ),
    },
    {
      key: "dateTime",
      label: "Date & Time",
      sortable: true,
      render: (_: any, row: Ride) => (
        <div className="text-sm">
          <div className="flex items-center gap-1 text-white/80">
            <Calendar className="w-3 h-3" />
            <span>{row.date}</span>
          </div>
          <div className="flex items-center gap-1 text-white/60">
            <Clock className="w-3 h-3" />
            <span>{row.time}</span>
          </div>
        </div>
      ),
    },
    {
      key: "seats",
      label: "Seats",
      render: (_: any, row: Ride) => (
        <div className="text-sm">
          <Badge
            variant={row.availableSeats === 0 ? "error" : row.availableSeats <= 1 ? "warning" : "success"}
            size="sm"
          >
            {row.availableSeats} / {row.totalSeats} Available
          </Badge>
          <div className="text-white/40 text-xs mt-1">{row.bookings} booked</div>
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center gap-1 text-green-500 font-semibold">
          <DollarSign className="w-4 h-4" />
          <span className="tabular-nums">{value}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: Ride) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction("view", row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-white/60" />
          </button>
          {(row.status === "scheduled" || row.status === "active") && (
            <button
              onClick={() => handleAction("cancel", row)}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Cancel Ride"
            >
              <Ban className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator variant="spinner" size="lg" text="Loading rides..." />
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
          <h1 className="text-3xl font-bold text-white">Rides Management</h1>
          <div className="flex gap-2">
            <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </AnimatedButton>
            <AnimatedButton variant="secondary" icon={<Download className="w-4 h-4" />}>
              Export
            </AnimatedButton>
          </div>
        </div>
        <p className="text-white/60">Monitor and manage all rides on the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Rides",
            value: rides.length,
            icon: <Car />,
            color: "text-blue-500",
            trend: "+8.2%",
          },
          {
            label: "Scheduled",
            value: rides.filter((r) => r.status === "scheduled").length,
            icon: <Calendar />,
            color: "text-purple-500",
          },
          {
            label: "Active Now",
            value: rides.filter((r) => r.status === "active").length,
            icon: <Navigation />,
            color: "text-green-500",
          },
          {
            label: "Completed",
            value: rides.filter((r) => r.status === "completed").length,
            icon: <CheckCircle />,
            color: "text-green-500",
          },
          {
            label: "Cancelled",
            value: rides.filter((r) => r.status === "cancelled").length,
            icon: <XCircle />,
            color: "text-red-500",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all duration-300 animate-scale-up"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 ${stat.color}`}>{stat.icon}</div>
              {stat.trend && (
                <div className="flex items-center gap-1 text-green-500 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  <span>{stat.trend}</span>
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{stat.value}</div>
            <div className="text-sm text-white/60">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          badge: tab.badge,
          content: null,
        }))}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pills"
      />

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ride ID, driver, location..."
            className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 text-white placeholder-white/40 focus:outline-none focus:border-primary/40"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        </div>
        <AnimatedButton variant="secondary">
          <Filter className="w-4 h-4" />
          Filters
        </AnimatedButton>
      </div>

      {/* Rides Table */}
      {filteredRides.length === 0 ? (
        <EmptyState
          icon={<Car />}
          title="No rides found"
          description="There are no rides matching your filters"
          variant="info"
        />
      ) : (
        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden animate-scale-up">
          <DataGrid
            columns={columns}
            data={filteredRides}
            pageSize={10}
            selectable
            onSelectionChange={setSelectedRides}
          />
        </div>
      )}

      {/* Action Modal */}
      <AnimatedModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, action: null, ride: null })}
        title={actionModal.action === "cancel" ? "Cancel Ride" : "Ride Details"}
        type={actionModal.action === "cancel" ? "error" : "info"}
      >
        <div className="space-y-4">
          {actionModal.ride && (
            <>
              <div className="bg-card/50 rounded-lg p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-white/60">{actionModal.ride.id}</span>
                  <StatusBadge status={actionModal.ride.status} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <span className="text-white/80">{actionModal.ride.from}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-red-500" />
                    <span className="text-white/80">{actionModal.ride.to}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-white/60">Driver</div>
                    <div className="text-white/90 font-medium">{actionModal.ride.driver.name}</div>
                  </div>
                  <div>
                    <div className="text-white/60">Price</div>
                    <div className="text-green-500 font-semibold">${actionModal.ride.price}</div>
                  </div>
                  <div>
                    <div className="text-white/60">Date & Time</div>
                    <div className="text-white/90">
                      {actionModal.ride.date} {actionModal.ride.time}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60">Available Seats</div>
                    <div className="text-white/90">
                      {actionModal.ride.availableSeats} / {actionModal.ride.totalSeats}
                    </div>
                  </div>
                </div>
              </div>

              {actionModal.action === "cancel" && (
                <>
                  <p className="text-white/80">
                    Are you sure you want to cancel this ride? All passengers will be notified and
                    refunded.
                  </p>
                  <div className="flex gap-3">
                    <AnimatedButton onClick={confirmCancel} variant="primary" className="flex-1">
                      Cancel Ride
                    </AnimatedButton>
                    <AnimatedButton
                      onClick={() => setActionModal({ isOpen: false, action: null, ride: null })}
                      variant="secondary"
                      className="flex-1"
                    >
                      Keep Ride
                    </AnimatedButton>
                  </div>
                </>
              )}

              {actionModal.action === "view" && (
                <div className="flex gap-2">
                  <AnimatedButton variant="primary" className="flex-1">
                    View Full Details
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => setActionModal({ isOpen: false, action: null, ride: null })}
                    variant="secondary"
                    className="flex-1"
                  >
                    Close
                  </AnimatedButton>
                </div>
              )}
            </>
          )}
        </div>
      </AnimatedModal>
    </div>
  );
}
