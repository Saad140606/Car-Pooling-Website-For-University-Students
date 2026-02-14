"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";
import {
  AlertTriangle,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  MessageSquare,
  Eye,
  CheckCheck,
  Archive,
  Trash2,
  MoreVertical,
  Download,
  TrendingUp,
  Flag,
  RefreshCw,
  Loader2,
  Shield,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type ReportStatus = "all" | "pending" | "investigating" | "resolved";
type ReportCategory = "all" | "misbehavior" | "safety" | "fraud" | "app_issue";

interface Report {
  id: string;
  reporterName: string;
  reporterEmail: string;
  reporterUniversity: string;
  category: string;
  status: string;
  createdAt: string;
  description: string;
  reportedBy?: any;
  againstUserUid?: string;
  rideId?: string;
  priority?: string;
}

export default function AdminReportsPage() {
  // 🔒 SECURITY: Verify admin authentication
  const { loading: authLoading, isAdmin, error: authError } = useAdminAuth();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReportStatus>("all");
  const [filterCategory, setFilterCategory] = useState<ReportCategory>("all");
  const [sortBy, setSortBy] = useState<"date" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError('Not authenticated');
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/reports?limit=200', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        const matchesSearch =
          r.reporterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.reporterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" || r.status === filterStatus;
        const matchesCategory = filterCategory === "all" || r.category === filterCategory;

        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        }
        return 0;
      });
  }, [reports, searchTerm, filterStatus, filterCategory, sortBy, sortOrder]);

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }), [reports]);

  const statusColors = {
    pending: "text-yellow-600",
    investigating: "text-blue-600",
    resolved: "text-green-600",
  };

  const statusBgColors = {
    pending: "bg-yellow-50",
    investigating: "bg-blue-50",
    resolved: "bg-green-50",
  };

  const categoryColors: Record<string, string> = {
    misbehavior: "text-red-600 bg-red-50",
    safety: "text-orange-600 bg-orange-50",
    fraud: "text-purple-600 bg-purple-50",
    app_issue: "text-pink-600 bg-pink-50",
  };

  // 🔒 SECURITY: Block rendering until admin verification completes
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <Shield className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-slate-400">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  // 🔒 SECURITY: Block access if not admin
  if (!isAdmin || authError) {
    return null; // Will redirect automatically
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-400">Loading reports...</p>
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
              <AlertTriangle className="w-10 h-10 text-primary" />
              Reports Management
            </h1>
            <p className="text-slate-400">Review and manage user reports</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 text-white rounded-xl font-medium transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Reports" value={stats.total} color="red" icon={AlertTriangle} />
        <StatBox label="Pending" value={stats.pending} color="yellow" icon={Clock} />
        <StatBox label="Investigating" value={stats.investigating} color="blue" icon={AlertCircle} />
        <StatBox label="Resolved" value={stats.resolved} color="green" icon={CheckCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Reports List */}
        <div className="lg:col-span-2">
          {/* Filters & Search */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Search Reports
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Reporter, email, category..."
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
                  onChange={(e) => setFilterStatus(e.target.value as ReportStatus)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
                >
                  <option value="all">All Reports</option>
                  <option value="pending">Pending</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as ReportCategory)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
              >
                <option value="all">All Categories</option>
                <option value="misbehavior">Misbehavior</option>
                <option value="safety">Safety</option>
                <option value="fraud">Fraud</option>
                <option value="app_issue">App Issue</option>
              </select>
            </div>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredReports.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No reports found</p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`bg-slate-900/50 border rounded-xl p-6 cursor-pointer transition-all hover:border-primary ${
                    selectedReport === report.id ? "border-primary bg-slate-800/50" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-bold text-primary">
                          {report.id.slice(0, 8).toUpperCase()}
                        </span>
                        {report.priority && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              report.priority === "high"
                                ? "bg-red-500/20 text-red-300"
                                : report.priority === "medium"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)}
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            statusBgColors[report.status as keyof typeof statusBgColors]
                          } ${statusColors[report.status as keyof typeof statusColors]}`}
                        >
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-2">
                        {report.reporterName || 'Unknown User'}
                      </h3>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-slate-400">Category</p>
                          <p className="text-sm text-white font-medium capitalize">
                            {report.category?.replace('_', ' ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">University</p>
                          <p className="text-sm text-white font-medium">
                            {report.reporterUniversity || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Date</p>
                          <p className="text-sm text-white font-medium">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-300 line-clamp-2">
                        {report.description || 'No description provided'}
                      </p>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right - Report Details */}
        <div className="lg:col-span-1">
          {selectedReport ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 sticky top-20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" />
                Report Details
              </h3>

              <div className="space-y-4">
                {/* Report Info */}
                <div className="border-b border-slate-700 pb-4">
                  <p className="text-xs text-slate-400 mb-1">Report ID</p>
                  <p className="font-mono text-white font-bold">RP001</p>
                </div>

                {/* Reporter Info */}
                <div className="border-b border-slate-700 pb-4">
                  <p className="text-xs text-slate-400 mb-2">Reporter</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <p className="text-white font-medium">Ahmed Hassan</p>
                  </div>
                </div>

                {/* Reported User */}
                <div className="border-b border-slate-700 pb-4">
                  <p className="text-xs text-slate-400 mb-2">Reported User</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-red-400" />
                    <p className="text-white font-medium">Unknown Driver</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-slate-700">
                  <button className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Mark In Progress
                  </button>
                  <button className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Resolve Report
                  </button>
                  <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Dismiss Report
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center h-full flex items-center justify-center">
              <div>
                <AlertTriangle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400">Select a report to view details</p>
              </div>
            </div>
          )}
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
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
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
