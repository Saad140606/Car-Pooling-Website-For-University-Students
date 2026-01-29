"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  MessageSquare,
  Flag,
  User,
  Car,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { FormField } from "@/components/FormField";
import { AnimatedModal } from "@/components/AnimatedModal";
import { AnimatedButton } from "@/components/AnimatedButton";

// ============================================================================
// REPORTS MANAGEMENT PAGE
// ============================================================================

interface Report {
  id: string;
  title: string;
  description: string;
  type: "safety" | "behavior" | "payment" | "other";
  status: "pending" | "investigating" | "resolved" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  reportedBy: {
    name: string;
    email: string;
    avatar?: string;
  };
  reportedUser: {
    name: string;
    email: string;
    avatar?: string;
  };
  rideId?: string;
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string;
  notes?: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: "resolve" | "reject" | "assign" | null;
    report: Report | null;
  }>({ isOpen: false, action: null, report: null });

  useEffect(() => {
    // Simulate loading reports
    const timer = setTimeout(() => {
      const mockReports: Report[] = [
        {
          id: "R001",
          title: "Unsafe Driving Behavior",
          description: "Driver was speeding and making sudden lane changes without signaling. Very unsafe ride experience.",
          type: "safety",
          status: "pending",
          priority: "urgent",
          reportedBy: {
            name: "Sarah Johnson",
            email: "sarah@mit.edu",
          },
          reportedUser: {
            name: "John Doe",
            email: "john@stanford.edu",
          },
          rideId: "RIDE123",
          createdAt: "2024-01-25 10:30 AM",
        },
        {
          id: "R002",
          title: "Inappropriate Behavior",
          description: "Made uncomfortable comments during the ride. Unprofessional conduct.",
          type: "behavior",
          status: "investigating",
          priority: "high",
          reportedBy: {
            name: "Emily Chen",
            email: "emily@harvard.edu",
          },
          reportedUser: {
            name: "Mike Wilson",
            email: "mike@yale.edu",
          },
          rideId: "RIDE124",
          createdAt: "2024-01-24 3:45 PM",
          assignedTo: "Admin Sarah",
        },
        {
          id: "R003",
          title: "Payment Dispute",
          description: "Driver charged more than agreed upon amount. Requesting refund.",
          type: "payment",
          status: "resolved",
          priority: "medium",
          reportedBy: {
            name: "Alex Kim",
            email: "alex@berkeley.edu",
          },
          reportedUser: {
            name: "Lisa Brown",
            email: "lisa@stanford.edu",
          },
          rideId: "RIDE125",
          createdAt: "2024-01-23 1:20 PM",
          updatedAt: "2024-01-24 9:00 AM",
          notes: "Refund processed. Driver warned about pricing policy.",
        },
        {
          id: "R004",
          title: "Driver No-Show",
          description: "Driver never showed up at pickup location. No communication.",
          type: "other",
          status: "pending",
          priority: "medium",
          reportedBy: {
            name: "David Lee",
            email: "david@mit.edu",
          },
          reportedUser: {
            name: "Jessica Taylor",
            email: "jessica@harvard.edu",
          },
          rideId: "RIDE126",
          createdAt: "2024-01-25 8:15 AM",
        },
        {
          id: "R005",
          title: "Vehicle Condition Issues",
          description: "Car was dirty and smelled bad. Not acceptable condition.",
          type: "other",
          status: "rejected",
          priority: "low",
          reportedBy: {
            name: "Rachel Green",
            email: "rachel@yale.edu",
          },
          reportedUser: {
            name: "Tom Anderson",
            email: "tom@stanford.edu",
          },
          rideId: "RIDE127",
          createdAt: "2024-01-22 4:30 PM",
          updatedAt: "2024-01-23 11:00 AM",
          notes: "Unable to verify complaint. Insufficient evidence.",
        },
      ];

      setReports(mockReports);
      setFilteredReports(mockReports);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Filter reports based on tab and search
  useEffect(() => {
    let filtered = reports;

    // Filter by status tab
    if (activeTab !== "all") {
      filtered = filtered.filter((r) => r.status === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.reportedBy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.reportedUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredReports(filtered);
  }, [activeTab, searchQuery, reports]);

  const toggleExpand = (reportId: string) => {
    const newExpanded = new Set(expandedReports);
    if (newExpanded.has(reportId)) {
      newExpanded.delete(reportId);
    } else {
      newExpanded.add(reportId);
    }
    setExpandedReports(newExpanded);
  };

  const getPriorityColor = (priority: Report["priority"]) => {
    switch (priority) {
      case "urgent":
        return "text-red-500 bg-red-500/10";
      case "high":
        return "text-orange-500 bg-orange-500/10";
      case "medium":
        return "text-amber-500 bg-amber-500/10";
      case "low":
        return "text-blue-500 bg-blue-500/10";
    }
  };

  const getTypeIcon = (type: Report["type"]) => {
    switch (type) {
      case "safety":
        return <AlertTriangle className="w-4 h-4" />;
      case "behavior":
        return <Flag className="w-4 h-4" />;
      case "payment":
        return <MessageSquare className="w-4 h-4" />;
      case "other":
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const handleAction = (action: "resolve" | "reject" | "assign", report: Report) => {
    setActionModal({ isOpen: true, action, report });
  };

  const confirmAction = () => {
    if (!actionModal.report) return;

    // Simulate API call
    const updatedReports = reports.map((r) => {
      if (r.id === actionModal.report!.id) {
        if (actionModal.action === "resolve") {
          return { ...r, status: "resolved" as const, updatedAt: new Date().toLocaleString() };
        } else if (actionModal.action === "reject") {
          return { ...r, status: "rejected" as const, updatedAt: new Date().toLocaleString() };
        }
      }
      return r;
    });

    setReports(updatedReports);
    setActionModal({ isOpen: false, action: null, report: null });
  };

  const tabs = [
    { id: "all", label: "All Reports", badge: reports.length },
    { id: "pending", label: "Pending", badge: reports.filter((r) => r.status === "pending").length },
    {
      id: "investigating",
      label: "Investigating",
      badge: reports.filter((r) => r.status === "investigating").length,
    },
    { id: "resolved", label: "Resolved", badge: reports.filter((r) => r.status === "resolved").length },
    { id: "rejected", label: "Rejected", badge: reports.filter((r) => r.status === "rejected").length },
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
          <h1 className="text-3xl font-bold text-white">Reports Management</h1>
          <div className="flex gap-2">
            <AnimatedButton
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </AnimatedButton>
            <AnimatedButton variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Export
            </AnimatedButton>
          </div>
        </div>
        <p className="text-white/60">Review and manage user reports and complaints</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Reports",
            value: reports.length,
            icon: <MessageSquare />,
            color: "text-blue-500",
          },
          {
            label: "Pending",
            value: reports.filter((r) => r.status === "pending").length,
            icon: <Clock />,
            color: "text-amber-500",
          },
          {
            label: "Resolved",
            value: reports.filter((r) => r.status === "resolved").length,
            icon: <CheckCircle />,
            color: "text-green-500",
          },
          {
            label: "High Priority",
            value: reports.filter((r) => r.priority === "high" || r.priority === "urgent").length,
            icon: <AlertTriangle />,
            color: "text-red-500",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all duration-300 animate-scale-up"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 ${stat.color} bg-white/5 rounded-lg`}>{stat.icon}</div>
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs and Search */}
      <div className="space-y-4">
        <Tabs
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            badge: tab.badge,
            content: null,
          }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="pills"
        />

        <div className="flex gap-4">
          <div className="flex-1">
            <FormField
              label=""
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search reports by ID, title, user..."
              icon={<Search />}
            />
          </div>
            <AnimatedButton variant="secondary">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </AnimatedButton>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No reports found"
          description="There are no reports matching your filters"
        />
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report, idx) => {
            const isExpanded = expandedReports.has(report.id);

            return (
              <div
                key={report.id}
                className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 stagger-item"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Report Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(report.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Report Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-white/60">{report.id}</span>
                        <Badge variant="secondary" className="capitalize">{report.status}</Badge>
                        <Badge variant="secondary">
                          <div className={`flex items-center gap-1 ${getPriorityColor(report.priority)}`}>
                            {getTypeIcon(report.type)}
                            <span className="capitalize">{report.type}</span>
                          </div>
                        </Badge>
                        <Badge
                          variant={
                            report.priority === "urgent"
                              ? "destructive"
                              : report.priority === "high"
                              ? "default"
                              : "secondary"
                          }
                          className={`${
                            report.priority === "urgent" ? "animate-pulse" : ""
                          }`}
                        >
                          {report.priority.toUpperCase()}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-semibold text-white">{report.title}</h3>

                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>By: {report.reportedBy.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flag className="w-4 h-4" />
                          <span>Against: {report.reportedUser.name}</span>
                        </div>
                        {report.rideId && (
                          <div className="flex items-center gap-1">
                            <Car className="w-4 h-4" />
                            <span>{report.rideId}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{report.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      {report.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction("resolve", report);
                            }}
                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction("reject", report);
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-white/60" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white/60" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-white/60" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-background/50 p-4 space-y-4 animate-fade-slide-up">
                    <div>
                      <div className="text-sm font-semibold text-white/80 mb-2">Description</div>
                      <p className="text-white/60">{report.description}</p>
                    </div>

                    {report.assignedTo && (
                      <div>
                        <div className="text-sm font-semibold text-white/80 mb-2">Assigned To</div>
                        <div className="text-white/60">{report.assignedTo}</div>
                      </div>
                    )}

                    {report.notes && (
                      <div>
                        <div className="text-sm font-semibold text-white/80 mb-2">Admin Notes</div>
                        <p className="text-white/60">{report.notes}</p>
                      </div>
                    )}

                    {report.updatedAt && (
                      <div className="text-xs text-white/40">Last updated: {report.updatedAt}</div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <AnimatedButton variant="secondary">
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </AnimatedButton>
                      {report.rideId && (
                        <AnimatedButton variant="secondary">
                          <Car className="w-4 h-4 mr-1" />
                          View Ride
                        </AnimatedButton>
                      )}
                      <AnimatedButton variant="secondary">
                        <User className="w-4 h-4 mr-1" />
                        View User Profile
                      </AnimatedButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Confirmation Modal */}
      <AnimatedModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, action: null, report: null })}
        title={`${actionModal.action === "resolve" ? "Resolve" : "Reject"} Report`}
        type={actionModal.action === "resolve" ? "success" : "error"}
      >
        <div className="space-y-4">
          <p className="text-white/80">
            Are you sure you want to {actionModal.action} report <strong>{actionModal.report?.id}</strong>?
          </p>
          {actionModal.action === "resolve" && (
            <p className="text-sm text-white/60">
              This will mark the report as resolved and notify both users.
            </p>
          )}
          {actionModal.action === "reject" && (
            <p className="text-sm text-white/60">
              This will reject the report. The reporter will be notified that their complaint could not be
              verified.
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <AnimatedButton onClick={confirmAction} className="flex-1">
              Confirm
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setActionModal({ isOpen: false, action: null, report: null })}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </AnimatedButton>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
}
