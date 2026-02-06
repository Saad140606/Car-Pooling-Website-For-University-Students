"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type ReportStatus = "all" | "pending" | "inProgress" | "resolved";
type ReportType = "all" | "inappropriate" | "safety" | "payment" | "behavior" | "other";

export default function AdminReportsPage() {
  const analytics = useAdminAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReportStatus>("all");
  const [filterType, setFilterType] = useState<ReportType>("all");
  const [sortBy, setSortBy] = useState<"date" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const mockReports = useMemo(() => {
    const reports = [
      {
        id: "report1",
        reportId: "RP001",
        reporter: "Ahmed Hassan",
        reportedUser: "Unknown Driver",
        type: "safety",
        status: "pending" as const,
        date: new Date(2026, 1, 4, 15, 30),
        description: "Driver was speeding and rash driving",
        rideId: "ride1",
        university: "FAST",
        severity: "high",
      },
      {
        id: "report2",
        reportId: "RP002",
        reporter: "Fatima Khan",
        reportedUser: "Zain Khan",
        type: "behavior",
        status: "inProgress" as const,
        date: new Date(2026, 1, 3, 14, 15),
        description: "Rude behavior during ride",
        rideId: "ride2",
        university: "NED",
        severity: "medium",
      },
      {
        id: "report3",
        reportId: "RP003",
        reporter: "Ali Raza",
        reportedUser: "Maha Ali",
        type: "payment",
        status: "resolved" as const,
        date: new Date(2026, 1, 2, 12, 45),
        description: "Payment discrepancy resolved",
        rideId: "ride3",
        university: "FAST",
        severity: "low",
      },
    ];

    return reports.filter((r) => {
      const matchesSearch =
        r.reporter.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reportedUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reportId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      const matchesType = filterType === "all" || r.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchTerm, filterStatus, filterType]);

  const sortedReports = useMemo(() => {
    return [...mockReports].sort((a, b) => {
      if (sortBy === "date") {
        const aTime = a.date.getTime();
        const bTime = b.date.getTime();
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      } else {
        const statusOrder = { pending: 0, inProgress: 1, resolved: 2 };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder];
        const bStatus = statusOrder[b.status as keyof typeof statusOrder];
        return sortOrder === "asc" ? aStatus - bStatus : bStatus - aStatus;
      }
    });
  }, [mockReports, sortBy, sortOrder]);

  const stats = {
    total: analytics.reports.total,
    pending: analytics.reports.pending,
    inProgress: analytics.reports.inProgress,
    resolved: analytics.reports.resolved,
  };

  const reportTypes = analytics.reports.types;

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
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
          <button className="px-6 py-3 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Reports
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Reports" value={stats.total} color="red" icon={AlertTriangle} />
        <StatBox label="Pending" value={stats.pending} color="yellow" icon={Clock} />
        <StatBox label="In Progress" value={stats.inProgress} color="blue" icon={AlertCircle} />
        <StatBox label="Resolved" value={stats.resolved} color="green" icon={CheckCircle} />
      </div>

      {/* Report Types */}
      {Object.keys(reportTypes).length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Report Types</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(reportTypes).map(([type, count]) => (
              <div
                key={type}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center gap-2"
              >
                <Flag className="w-4 h-4 text-primary" />
                <span className="text-white font-medium capitalize">{type}</span>
                <span className="px-2 py-1 bg-primary/20 text-primary rounded font-bold text-sm">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    placeholder="Reporter, reported user, report ID..."
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
                  <option value="pending">Pending Only</option>
                  <option value="inProgress">In Progress</option>
                  <option value="resolved">Resolved Only</option>
                </select>
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ReportType)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
              >
                <option value="all">All Types</option>
                <option value="safety">Safety</option>
                <option value="behavior">Behavior</option>
                <option value="payment">Payment</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {sortedReports.map((report) => (
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
                      <span className="font-mono text-sm font-bold text-primary">{report.reportId}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          report.severity === "high"
                            ? "bg-red-500/20 text-red-300"
                            : report.severity === "medium"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          report.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : report.status === "inProgress"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {report.status === "inProgress" ? "In Progress" : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      {report.reporter} reported {report.reportedUser}
                    </h3>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Type</p>
                        <p className="text-sm text-white font-medium capitalize">{report.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">University</p>
                        <p className="text-sm text-white font-medium">{report.university}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Date</p>
                        <p className="text-sm text-white font-medium">
                          {report.date.toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300">{report.description}</p>
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
            ))}
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
