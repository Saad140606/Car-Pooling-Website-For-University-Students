"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Shield,
  Calendar,
  MapPin,
  Star,
  Ban,
  Eye,
  Edit,
  MoreVertical,
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { DataGrid } from "@/components/ui/table";
import { AnimatedButton } from "@/components/AnimatedButton";
import { AnimatedModal } from "@/components/AnimatedModal";

// ============================================================================
// USERS MANAGEMENT PAGE
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  university: string;
  status: "active" | "suspended" | "pending" | "banned";
  verified: boolean;
  role: "user" | "driver" | "admin";
  joinedAt: string;
  lastActive: string;
  ridesAsDriver: number;
  ridesAsPassenger: number;
  rating: number;
  totalReviews: number;
  avatar?: string;
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: "suspend" | "ban" | "activate" | null;
    user: User | null;
  }>({ isOpen: false, action: null, user: null });

  useEffect(() => {
    // Simulate loading users
    const timer = setTimeout(() => {
      const mockUsers: User[] = [
        {
          id: "U001",
          name: "John Smith",
          email: "john.smith@mit.edu",
          phone: "+1 (555) 123-4567",
          university: "MIT",
          status: "active",
          verified: true,
          role: "driver",
          joinedAt: "2023-08-15",
          lastActive: "2 hours ago",
          ridesAsDriver: 45,
          ridesAsPassenger: 12,
          rating: 4.8,
          totalReviews: 38,
        },
        {
          id: "U002",
          name: "Emma Wilson",
          email: "emma.wilson@stanford.edu",
          university: "Stanford University",
          status: "pending",
          verified: false,
          role: "user",
          joinedAt: "2024-01-25",
          lastActive: "10 min ago",
          ridesAsDriver: 0,
          ridesAsPassenger: 0,
          rating: 0,
          totalReviews: 0,
        },
        {
          id: "U003",
          name: "Michael Chen",
          email: "michael.chen@harvard.edu",
          phone: "+1 (555) 987-6543",
          university: "Harvard University",
          status: "active",
          verified: true,
          role: "driver",
          joinedAt: "2023-09-20",
          lastActive: "1 day ago",
          ridesAsDriver: 78,
          ridesAsPassenger: 23,
          rating: 4.9,
          totalReviews: 65,
        },
        {
          id: "U004",
          name: "Sarah Johnson",
          email: "sarah.j@yale.edu",
          phone: "+1 (555) 456-7890",
          university: "Yale University",
          status: "active",
          verified: true,
          role: "user",
          joinedAt: "2023-10-05",
          lastActive: "3 hours ago",
          ridesAsDriver: 5,
          ridesAsPassenger: 34,
          rating: 4.7,
          totalReviews: 28,
        },
        {
          id: "U005",
          name: "David Lee",
          email: "david.lee@berkeley.edu",
          university: "UC Berkeley",
          status: "suspended",
          verified: true,
          role: "driver",
          joinedAt: "2023-07-12",
          lastActive: "1 week ago",
          ridesAsDriver: 32,
          ridesAsPassenger: 8,
          rating: 3.9,
          totalReviews: 25,
        },
        {
          id: "U006",
          name: "Rachel Green",
          email: "rachel.g@princeton.edu",
          phone: "+1 (555) 321-0987",
          university: "Princeton University",
          status: "banned",
          verified: true,
          role: "user",
          joinedAt: "2023-06-18",
          lastActive: "2 weeks ago",
          ridesAsDriver: 0,
          ridesAsPassenger: 12,
          rating: 2.5,
          totalReviews: 8,
        },
        {
          id: "U007",
          name: "Tom Anderson",
          email: "tom.a@cornell.edu",
          university: "Cornell University",
          status: "active",
          verified: true,
          role: "driver",
          joinedAt: "2023-11-03",
          lastActive: "30 min ago",
          ridesAsDriver: 56,
          ridesAsPassenger: 15,
          rating: 4.6,
          totalReviews: 42,
        },
        {
          id: "U008",
          name: "Lisa White",
          email: "lisa.w@columbia.edu",
          phone: "+1 (555) 654-3210",
          university: "Columbia University",
          status: "active",
          verified: true,
          role: "user",
          joinedAt: "2023-12-01",
          lastActive: "1 hour ago",
          ridesAsDriver: 0,
          ridesAsPassenger: 19,
          rating: 4.8,
          totalReviews: 15,
        },
      ];

      setUsers(mockUsers);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (action: "suspend" | "ban" | "activate", user: User) => {
    setActionModal({ isOpen: true, action, user });
  };

  const confirmAction = () => {
    if (!actionModal.user || !actionModal.action) return;

    const updatedUsers = users.map((u) => {
      if (u.id === actionModal.user!.id) {
        return {
          ...u,
          status:
            actionModal.action === "activate"
              ? ("active" as const)
              : actionModal.action === "suspend"
              ? ("suspended" as const)
              : ("banned" as const),
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    setActionModal({ isOpen: false, action: null, user: null });
  };

  const columns = [
    {
      key: "name",
      label: "User",
      sortable: true,
      render: (value: any, row: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-white font-semibold">
            {row.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              {row.name}
              {row.verified && <Shield className="w-3 h-3 text-green-500" />}
            </div>
            <div className="text-sm text-white/60">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "university",
      label: "University",
      sortable: true,
      render: (value: string) => <span className="text-white/80">{value}</span>,
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === "driver" ? "success" : "secondary"} size="sm">
          {value.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "rating",
      label: "Rating",
      sortable: true,
      render: (value: number, row: User) => (
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="text-white font-semibold tabular-nums">{value.toFixed(1)}</span>
          <span className="text-white/40 text-sm">({row.totalReviews})</span>
        </div>
      ),
    },
    {
      key: "rides",
      label: "Rides",
      render: (_: any, row: User) => (
        <div className="text-sm">
          <div className="text-white/80">
            <span className="font-semibold">{row.ridesAsDriver}</span> driver
          </div>
          <div className="text-white/60">
            <span className="font-semibold">{row.ridesAsPassenger}</span> passenger
          </div>
        </div>
      ),
    },
    {
      key: "lastActive",
      label: "Last Active",
      sortable: true,
      render: (value: string) => <span className="text-white/60 text-sm">{value}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {}}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="View Profile"
          >
            <Eye className="w-4 h-4 text-white/60" />
          </button>
          {row.status === "active" && (
            <button
              onClick={() => handleAction("suspend", row)}
              className="p-2 hover:bg-amber-500/20 rounded-lg transition-colors"
              title="Suspend User"
            >
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </button>
          )}
          {(row.status === "suspended" || row.status === "pending") && (
            <button
              onClick={() => handleAction("activate", row)}
              className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
              title="Activate User"
            >
              <UserCheck className="w-4 h-4 text-green-500" />
            </button>
          )}
          {row.status !== "banned" && (
            <button
              onClick={() => handleAction("ban", row)}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Ban User"
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
        <LoadingIndicator variant="spinner" size="lg" text="Loading users..." />
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
          <h1 className="text-3xl font-bold text-white">Users Management</h1>
          <div className="flex gap-2">
            <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </AnimatedButton>
            <AnimatedButton variant="secondary" icon={<Download className="w-4 h-4" />}>
              Export
            </AnimatedButton>
          </div>
        </div>
        <p className="text-white/60">Manage user accounts and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Users",
            value: users.length,
            icon: <Users />,
            color: "text-blue-500",
            trend: "+12.5%",
          },
          {
            label: "Active",
            value: users.filter((u) => u.status === "active").length,
            icon: <UserCheck />,
            color: "text-green-500",
          },
          {
            label: "Verified",
            value: users.filter((u) => u.verified).length,
            icon: <Shield />,
            color: "text-purple-500",
          },
          {
            label: "Suspended/Banned",
            value: users.filter((u) => u.status === "suspended" || u.status === "banned").length,
            icon: <Ban />,
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

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, university..."
            className="w-full px-4 py-2 rounded-lg bg-surface border border-primary/20 text-white placeholder-white/40 focus:outline-none focus:border-primary/40"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        </div>
        <AnimatedButton variant="secondary">
          <Filter className="w-4 h-4" />
          Filters
        </AnimatedButton>
      </div>

      {/* Users Table */}
      <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden animate-scale-up">
        <DataGrid
          columns={columns}
          data={filteredUsers}
          pageSize={pageSize}
          selectable
          onSelectionChange={setSelectedUsers}
        />
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl animate-slide-up">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium">{selectedUsers.length} users selected</span>
            <div className="flex gap-2">
              <AnimatedButton variant="secondary" size="sm">
                Send Email
              </AnimatedButton>
              <AnimatedButton variant="secondary" size="sm">
                Export Selected
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      <AnimatedModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, action: null, user: null })}
        title={`${actionModal.action === "activate" ? "Activate" : actionModal.action === "suspend" ? "Suspend" : "Ban"} User`}
        type={
          actionModal.action === "activate"
            ? "success"
            : actionModal.action === "suspend"
            ? "warning"
            : "error"
        }
      >
        <div className="space-y-4">
          {actionModal.user && (
            <>
              <div className="bg-card/50 rounded-lg p-4 border border-white/10">
                <div className="font-semibold text-white mb-1">{actionModal.user.name}</div>
                <div className="text-sm text-white/60">{actionModal.user.email}</div>
                <div className="text-sm text-white/60">{actionModal.user.university}</div>
              </div>

              <p className="text-white/80">
                {actionModal.action === "activate" &&
                  "This will reactivate the user account and restore all privileges."}
                {actionModal.action === "suspend" &&
                  "This will temporarily suspend the user account. They will not be able to create or join rides."}
                {actionModal.action === "ban" &&
                  "This will permanently ban the user from the platform. This action cannot be easily undone."}
              </p>

              <div className="flex gap-3 pt-2">
                <AnimatedButton onClick={confirmAction} variant="primary" className="flex-1">
                  Confirm
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => setActionModal({ isOpen: false, action: null, user: null })}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AnimatedButton>
              </div>
            </>
          )}
        </div>
      </AnimatedModal>
    </div>
  );
}
