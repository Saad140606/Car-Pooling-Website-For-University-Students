"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Shield,
  FileText,
  Car,
  CreditCard,
  AlertCircle,
  Eye,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { AnimatedModal } from "@/components/AnimatedModal";
import { AnimatedButton } from "@/components/AnimatedButton";

// ============================================================================
// PENDING APPROVALS PAGE
// ============================================================================

interface Approval {
  id: string;
  type: "email_verification" | "driver_license" | "id_verification" | "vehicle_registration" | "insurance";
  user: {
    id: string;
    name: string;
    email: string;
    university?: string;
    avatar?: string;
  };
  status: "pending" | "approved" | "rejected" | "expired";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  priority: "low" | "medium" | "high";
  documents?: {
    name: string;
    url: string;
    type: string;
  }[];
  notes?: string;
  rejectionReason?: string;
}

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filteredApprovals, setFilteredApprovals] = useState<Approval[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [expandedApprovals, setExpandedApprovals] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | null;
    approval: Approval | null;
  }>({ isOpen: false, action: null, approval: null });
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    // Simulate loading approvals
    const timer = setTimeout(() => {
      const mockApprovals: Approval[] = [
        {
          id: "A001",
          type: "email_verification",
          user: {
            id: "U001",
            name: "Emma Wilson",
            email: "emma.wilson@stanford.edu",
            university: "Stanford University",
          },
          status: "pending",
          submittedAt: "2024-01-25 10:30 AM",
          priority: "high",
        },
        {
          id: "A002",
          type: "driver_license",
          user: {
            id: "U002",
            name: "Michael Chen",
            email: "michael.chen@mit.edu",
            university: "MIT",
          },
          status: "pending",
          submittedAt: "2024-01-25 9:15 AM",
          priority: "high",
          documents: [
            { name: "Driver License - Front", url: "#", type: "image/jpeg" },
            { name: "Driver License - Back", url: "#", type: "image/jpeg" },
          ],
        },
        {
          id: "A003",
          type: "id_verification",
          user: {
            id: "U003",
            name: "Sarah Johnson",
            email: "sarah.j@harvard.edu",
            university: "Harvard University",
          },
          status: "pending",
          submittedAt: "2024-01-24 4:20 PM",
          priority: "medium",
          documents: [{ name: "Student ID", url: "#", type: "image/png" }],
        },
        {
          id: "A004",
          type: "vehicle_registration",
          user: {
            id: "U004",
            name: "David Lee",
            email: "david.lee@yale.edu",
            university: "Yale University",
          },
          status: "approved",
          submittedAt: "2024-01-23 2:10 PM",
          reviewedAt: "2024-01-24 10:00 AM",
          reviewedBy: "Admin John",
          priority: "medium",
          documents: [{ name: "Vehicle Registration", url: "#", type: "application/pdf" }],
          notes: "All documents verified. Vehicle matches registration.",
        },
        {
          id: "A005",
          type: "insurance",
          user: {
            id: "U005",
            name: "Rachel Green",
            email: "rachel.g@berkeley.edu",
            university: "UC Berkeley",
          },
          status: "rejected",
          submittedAt: "2024-01-22 1:30 PM",
          reviewedAt: "2024-01-23 9:45 AM",
          reviewedBy: "Admin Sarah",
          priority: "low",
          documents: [{ name: "Insurance Card", url: "#", type: "image/jpeg" }],
          rejectionReason: "Insurance document is expired. Please submit current insurance proof.",
        },
        {
          id: "A006",
          type: "driver_license",
          user: {
            id: "U006",
            name: "Tom Anderson",
            email: "tom.a@princeton.edu",
            university: "Princeton University",
          },
          status: "pending",
          submittedAt: "2024-01-25 11:45 AM",
          priority: "high",
          documents: [
            { name: "Driver License - Front", url: "#", type: "image/jpeg" },
            { name: "Driver License - Back", url: "#", type: "image/jpeg" },
          ],
        },
      ];

      setApprovals(mockApprovals);
      setFilteredApprovals(mockApprovals);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Filter approvals based on tab and search
  useEffect(() => {
    let filtered = approvals;

    // Filter by status tab
    if (activeTab !== "all") {
      filtered = filtered.filter((a) => a.status === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (a) =>
          a.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredApprovals(filtered);
  }, [activeTab, searchQuery, approvals]);

  const toggleExpand = (approvalId: string) => {
    const newExpanded = new Set(expandedApprovals);
    if (newExpanded.has(approvalId)) {
      newExpanded.delete(approvalId);
    } else {
      newExpanded.add(approvalId);
    }
    setExpandedApprovals(newExpanded);
  };

  const handleAction = (action: "approve" | "reject", approval: Approval) => {
    setActionModal({ isOpen: true, action, approval });
    setRejectionReason("");
  };

  const confirmAction = () => {
    if (!actionModal.approval) return;

    const updatedApprovals = approvals.map((a) => {
      if (a.id === actionModal.approval!.id) {
        if (actionModal.action === "approve") {
          return {
            ...a,
            status: "approved" as const,
            reviewedAt: new Date().toLocaleString(),
            reviewedBy: "Admin User",
            notes: "Approved after review",
          };
        } else if (actionModal.action === "reject") {
          return {
            ...a,
            status: "rejected" as const,
            reviewedAt: new Date().toLocaleString(),
            reviewedBy: "Admin User",
            rejectionReason: rejectionReason,
          };
        }
      }
      return a;
    });

    setApprovals(updatedApprovals);
    setActionModal({ isOpen: false, action: null, approval: null });
    setRejectionReason("");
  };

  const getTypeIcon = (type: Approval["type"]) => {
    switch (type) {
      case "email_verification":
        return <Mail className="w-4 h-4" />;
      case "driver_license":
        return <CreditCard className="w-4 h-4" />;
      case "id_verification":
        return <User className="w-4 h-4" />;
      case "vehicle_registration":
        return <Car className="w-4 h-4" />;
      case "insurance":
        return <Shield className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: Approval["type"]) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getPriorityColor = (priority: Approval["priority"]) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-blue-500";
    }
  };

  const tabs = [
    { id: "all", label: "All Requests", badge: approvals.length },
    { id: "pending", label: "Pending", badge: approvals.filter((a) => a.status === "pending").length },
    { id: "approved", label: "Approved", badge: approvals.filter((a) => a.status === "approved").length },
    { id: "rejected", label: "Rejected", badge: approvals.filter((a) => a.status === "rejected").length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
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
          <h1 className="text-3xl font-bold text-white">Pending Approvals</h1>
          <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
            {approvals.filter((a) => a.status === "pending").length} Pending
          </Badge>
        </div>
        <p className="text-white/60">Review and approve user verification requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Requests",
            value: approvals.length,
            icon: <FileText />,
            color: "text-blue-500",
          },
          {
            label: "Pending",
            value: approvals.filter((a) => a.status === "pending").length,
            icon: <Clock />,
            color: "text-amber-500",
          },
          {
            label: "Approved",
            value: approvals.filter((a) => a.status === "approved").length,
            icon: <CheckCircle />,
            color: "text-green-500",
          },
          {
            label: "Rejected",
            value: approvals.filter((a) => a.status === "rejected").length,
            icon: <XCircle />,
            color: "text-red-500",
          },
          {
            label: "High Priority",
            value: approvals.filter((a) => a.priority === "high" && a.status === "pending").length,
            icon: <AlertCircle />,
            color: "text-red-500",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all duration-300 animate-scale-up"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="flex flex-col gap-2">
              <div className={`w-8 h-8 ${stat.color}`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-white tabular-nums">{stat.value}</div>
              <div className="text-sm text-white/60">{stat.label}</div>
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
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, type..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-primary/50"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            </div>
          </div>
          <AnimatedButton variant="secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </AnimatedButton>
        </div>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No approval requests found"
          description="There are no requests matching your filters"
        />
      ) : (
        <div className="space-y-3">
          {filteredApprovals.map((approval, idx) => {
            const isExpanded = expandedApprovals.has(approval.id);

            return (
              <div
                key={approval.id}
                className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 stagger-item"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Approval Header */}
                <div
                  className="p-5 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(approval.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: User & Type Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-white font-semibold">
                        {approval.user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-white">{approval.user.name}</h3>
                          <Badge variant="secondary" className="capitalize">{approval.status}</Badge>
                          {approval.priority === "high" && (
                            <Badge variant="destructive" className="animate-pulse">
                              HIGH PRIORITY
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/60 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {approval.user.email}
                          </span>
                          {approval.user.university && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {approval.user.university}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {approval.submittedAt}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            <div className="flex items-center gap-1 text-primary">
                              {getTypeIcon(approval.type)}
                              <span>{getTypeLabel(approval.type)}</span>
                            </div>
                          </Badge>
                          <span className="text-xs text-white/40 font-mono">{approval.id}</span>
                          {approval.documents && approval.documents.length > 0 && (
                            <Badge variant="secondary">
                              {approval.documents.length} Document{approval.documents.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      {approval.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction("approve", approval);
                            }}
                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction("reject", approval);
                            }}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}
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
                  <div className="border-t border-white/10 bg-background/50 p-5 space-y-4 animate-fade-slide-up">
                    {/* Documents */}
                    {approval.documents && approval.documents.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-white/80 mb-3">Submitted Documents</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {approval.documents.map((doc, docIdx) => (
                            <div
                              key={docIdx}
                              className="flex items-center justify-between p-3 bg-card/50 border border-white/10 rounded-lg hover:border-primary/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{doc.name}</div>
                                  <div className="text-xs text-white/40">{doc.type}</div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                  <Eye className="w-4 h-4 text-white/60" />
                                </button>
                                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                  <Download className="w-4 h-4 text-white/60" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Info */}
                    {(approval.reviewedAt || approval.notes || approval.rejectionReason) && (
                      <div className="space-y-3">
                        {approval.reviewedAt && (
                          <div>
                            <div className="text-sm font-semibold text-white/80 mb-1">Review Details</div>
                            <div className="text-sm text-white/60">
                              Reviewed by <span className="text-white/80">{approval.reviewedBy}</span> on{" "}
                              {approval.reviewedAt}
                            </div>
                          </div>
                        )}

                        {approval.notes && (
                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <div className="text-sm font-semibold text-green-500 mb-1">Admin Notes</div>
                            <p className="text-sm text-white/70">{approval.notes}</p>
                          </div>
                        )}

                        {approval.rejectionReason && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <div className="text-sm font-semibold text-red-500 mb-1">Rejection Reason</div>
                            <p className="text-sm text-white/70">{approval.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <AnimatedButton variant="secondary">
                        <User className="w-4 h-4 mr-1" />
                        View User Profile
                      </AnimatedButton>
                      <AnimatedButton variant="secondary">
                        <Eye className="w-4 h-4 mr-1" />
                        View Full Details
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
        onClose={() => {
          setActionModal({ isOpen: false, action: null, approval: null });
          setRejectionReason("");
        }}
        title={`${actionModal.action === "approve" ? "Approve" : "Reject"} Request`}
        type={actionModal.action === "approve" ? "success" : "error"}
      >
        <div className="space-y-4">
          {actionModal.approval && (
            <>
              <div className="bg-card/50 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  {getTypeIcon(actionModal.approval.type)}
                  <span className="font-semibold text-white">{getTypeLabel(actionModal.approval.type)}</span>
                </div>
                <div className="text-sm text-white/60">
                  User: <span className="text-white/80">{actionModal.approval.user.name}</span>
                </div>
                <div className="text-sm text-white/60">
                  Email: <span className="text-white/80">{actionModal.approval.user.email}</span>
                </div>
              </div>

              {actionModal.action === "approve" && (
                <p className="text-sm text-white/80">
                  This will approve the {getTypeLabel(actionModal.approval.type).toLowerCase()} request and
                  notify the user.
                </p>
              )}

              {actionModal.action === "reject" && (
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a reason for rejection..."
                    rows={4}
                    className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 resize-none"
                    required
                  />
                  <p className="text-xs text-white/60 mt-2">
                    The user will be notified with this reason and can resubmit their request.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <AnimatedButton
                  onClick={confirmAction}
                  disabled={actionModal.action === "reject" && !rejectionReason.trim()}
                  className="flex-1"
                >
                  {actionModal.action === "approve" ? "Approve Request" : "Reject Request"}
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => {
                    setActionModal({ isOpen: false, action: null, approval: null });
                    setRejectionReason("");
                  }}
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
