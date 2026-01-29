"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  MessageSquare,
  Phone,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Archive,
  Star,
  Search,
  Filter,
  Eye,
  Reply,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { AnimatedModal } from "@/components/AnimatedModal";
import { AnimatedButton } from "@/components/AnimatedButton";

// ============================================================================
// CONTACTS MANAGEMENT PAGE
// ============================================================================

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: "general" | "support" | "feedback" | "complaint" | "other";
  status: "new" | "read" | "replied" | "resolved" | "archived";
  priority: "low" | "medium" | "high";
  createdAt: string;
  repliedAt?: string;
  repliedBy?: string;
  replyMessage?: string;
  starred?: boolean;
}

export default function ContactsPage() {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [replyModal, setReplyModal] = useState<{ isOpen: boolean; contact: Contact | null }>({
    isOpen: false,
    contact: null,
  });
  const [replyMessage, setReplyMessage] = useState("");

  useEffect(() => {
    // Simulate loading contacts
    const timer = setTimeout(() => {
      const mockContacts: Contact[] = [
        {
          id: "C001",
          name: "John Smith",
          email: "john.smith@mit.edu",
          phone: "+1 (555) 123-4567",
          subject: "Question about ride verification",
          message:
            "Hi, I've been trying to verify my university email but haven't received the verification code. Can you help?",
          category: "support",
          status: "new",
          priority: "high",
          createdAt: "2024-01-25 11:30 AM",
          starred: true,
        },
        {
          id: "C002",
          name: "Emily Davis",
          email: "emily.davis@stanford.edu",
          subject: "Feedback on the platform",
          message:
            "I love the new interface! The ride booking process is much smoother now. One suggestion: could you add a dark mode?",
          category: "feedback",
          status: "read",
          priority: "low",
          createdAt: "2024-01-24 3:15 PM",
        },
        {
          id: "C003",
          name: "Michael Chen",
          email: "michael.chen@harvard.edu",
          phone: "+1 (555) 987-6543",
          subject: "Payment issue",
          message:
            "I was charged twice for the same ride. The transaction IDs are TXN123 and TXN124. Please investigate and process a refund.",
          category: "complaint",
          status: "replied",
          priority: "high",
          createdAt: "2024-01-23 10:20 AM",
          repliedAt: "2024-01-23 2:45 PM",
          repliedBy: "Admin Sarah",
          replyMessage:
            "Thank you for bringing this to our attention. We've verified the duplicate charge and processed a refund. You should see it in your account within 3-5 business days.",
        },
        {
          id: "C004",
          name: "Sarah Williams",
          email: "sarah.w@yale.edu",
          subject: "Partnership inquiry",
          message:
            "I represent the Yale Student Government and we're interested in partnering with Campus Ride for our transportation program.",
          category: "general",
          status: "new",
          priority: "medium",
          createdAt: "2024-01-25 9:00 AM",
          starred: true,
        },
        {
          id: "C005",
          name: "David Brown",
          email: "d.brown@berkeley.edu",
          subject: "Feature request",
          message:
            "Could you add a feature to schedule recurring rides? I have the same commute every Monday, Wednesday, and Friday.",
          category: "feedback",
          status: "resolved",
          priority: "medium",
          createdAt: "2024-01-20 1:30 PM",
          repliedAt: "2024-01-22 10:15 AM",
          repliedBy: "Admin John",
          replyMessage:
            "Great suggestion! We're actually working on this feature and it should be available in the next update.",
        },
        {
          id: "C006",
          name: "Lisa Anderson",
          email: "lisa.a@princeton.edu",
          subject: "Account deletion request",
          message: "I would like to delete my account. Please confirm the process and timeline.",
          category: "support",
          status: "archived",
          priority: "low",
          createdAt: "2024-01-18 4:20 PM",
          repliedAt: "2024-01-19 9:00 AM",
          repliedBy: "Admin Mike",
          replyMessage:
            "Account deletion request processed. Your data will be permanently deleted within 30 days.",
        },
      ];

      setContacts(mockContacts);
      setFilteredContacts(mockContacts);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Filter contacts based on tab and search
  useEffect(() => {
    let filtered = contacts;

    // Filter by status tab
    if (activeTab !== "all") {
      if (activeTab === "unread") {
        filtered = filtered.filter((c) => c.status === "new");
      } else if (activeTab === "starred") {
        filtered = filtered.filter((c) => c.starred);
      } else {
        filtered = filtered.filter((c) => c.status === activeTab);
      }
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredContacts(filtered);
  }, [activeTab, searchQuery, contacts]);

  const handleReply = (contact: Contact) => {
    setReplyModal({ isOpen: true, contact });
    setReplyMessage("");
  };

  const sendReply = () => {
    if (!replyModal.contact || !replyMessage.trim()) return;

    // Simulate sending reply
    const updatedContacts = contacts.map((c) => {
      if (c.id === replyModal.contact!.id) {
        return {
          ...c,
          status: "replied" as const,
          repliedAt: new Date().toLocaleString(),
          repliedBy: "Admin User",
          replyMessage: replyMessage,
        };
      }
      return c;
    });

    setContacts(updatedContacts);
    setReplyModal({ isOpen: false, contact: null });
    setReplyMessage("");
  };

  const toggleStar = (contactId: string) => {
    const updatedContacts = contacts.map((c) => {
      if (c.id === contactId) {
        return { ...c, starred: !c.starred };
      }
      return c;
    });
    setContacts(updatedContacts);
  };

  const markAsRead = (contactId: string) => {
    const updatedContacts = contacts.map((c) => {
      if (c.id === contactId && c.status === "new") {
        return { ...c, status: "read" as const };
      }
      return c;
    });
    setContacts(updatedContacts);
  };

  const getCategoryColor = (category: Contact["category"]) => {
    switch (category) {
      case "support":
        return "text-blue-500 bg-blue-500/10";
      case "feedback":
        return "text-green-500 bg-green-500/10";
      case "complaint":
        return "text-red-500 bg-red-500/10";
      case "general":
        return "text-purple-500 bg-purple-500/10";
      case "other":
        return "text-gray-500 bg-gray-500/10";
    }
  };

  const getPriorityColor = (priority: Contact["priority"]) => {
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
    { id: "all", label: "All Messages", badge: contacts.length },
    { id: "unread", label: "Unread", badge: contacts.filter((c) => c.status === "new").length },
    { id: "starred", label: "Starred", badge: contacts.filter((c) => c.starred).length },
    { id: "replied", label: "Replied", badge: contacts.filter((c) => c.status === "replied").length },
    { id: "resolved", label: "Resolved", badge: contacts.filter((c) => c.status === "resolved").length },
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
          <h1 className="text-3xl font-bold text-white">Contact Messages</h1>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
              {contacts.filter((c) => c.status === "new").length} New
            </Badge>
          </div>
        </div>
        <p className="text-white/60">Manage user inquiries, feedback, and support requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Messages",
            value: contacts.length,
            icon: <Mail />,
            color: "text-blue-500",
          },
          {
            label: "Unread",
            value: contacts.filter((c) => c.status === "new").length,
            icon: <MessageSquare />,
            color: "text-amber-500",
          },
          {
            label: "Replied",
            value: contacts.filter((c) => c.status === "replied").length,
            icon: <Reply />,
            color: "text-green-500",
          },
          {
            label: "Starred",
            value: contacts.filter((c) => c.starred).length,
            icon: <Star />,
            color: "text-yellow-500",
          },
          {
            label: "Resolved",
            value: contacts.filter((c) => c.status === "resolved").length,
            icon: <CheckCircle />,
            color: "text-green-500",
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
          variant="underline"
        />

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, subject..."
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

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="No messages found"
          description="There are no messages matching your filters"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredContacts.map((contact, idx) => (
            <div
              key={contact.id}
              className={`
                bg-card/50 backdrop-blur-sm border rounded-xl p-5
                hover:border-primary/30 hover:bg-card/70
                transition-all duration-300 cursor-pointer
                stagger-item
                ${contact.status === "new" ? "border-primary/20" : "border-white/10"}
              `}
              style={{ animationDelay: `${idx * 80}ms` }}
              onClick={() => {
                setSelectedContact(contact);
                markAsRead(contact.id);
              }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-white font-semibold">
                  {contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className={`text-lg font-semibold ${
                            contact.status === "new" ? "text-white" : "text-white/80"
                          }`}
                        >
                          {contact.name}
                        </h3>
                        {contact.status === "new" && (
                          <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                            NEW
                          </Badge>
                        )}
                        {contact.starred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-white/60 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                        {contact.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {contact.createdAt}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(contact.id);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            contact.starred ? "text-yellow-500 fill-yellow-500" : "text-white/40"
                          }`}
                        />
                      </button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-white/60" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="secondary">
                      <div className={`flex items-center gap-1 ${getCategoryColor(contact.category)}`}>
                        <MessageSquare className="w-3 h-3" />
                        <span className="capitalize">{contact.category}</span>
                      </div>
                    </Badge>
                    <Badge
                      variant={
                        contact.priority === "high"
                          ? "destructive"
                          : contact.priority === "medium"
                          ? "default"
                          : "info"
                      }
                      size="sm"
                    >
                      {contact.priority.toUpperCase()}
                    </Badge>
                    <StatusBadge status={contact.status} />
                    <span className="text-xs text-white/40 font-mono">{contact.id}</span>
                  </div>

                  {/* Subject and Message Preview */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white/90">{contact.subject}</h4>
                    <p className="text-sm text-white/60 line-clamp-2">{contact.message}</p>
                  </div>

                  {/* Reply Info */}
                  {contact.repliedAt && contact.replyMessage && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-green-500">
                        <CheckCircle className="w-3 h-3" />
                        <span>
                          Replied by {contact.repliedBy} on {contact.repliedAt}
                        </span>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <p className="text-sm text-white/70">{contact.replyMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {contact.status !== "replied" && contact.status !== "resolved" && (
                      <AnimatedButton
                        variant="primary"
                        size="sm"
                        icon={<Reply className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(contact);
                        }}
                      >
                        Reply
                      </AnimatedButton>
                    )}
                    <AnimatedButton variant="secondary">
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </AnimatedButton>
                    {contact.status === "replied" && (
                      <AnimatedButton variant="secondary">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Resolved
                      </AnimatedButton>
                    )}
                    <AnimatedButton variant="secondary">
                      <Archive className="w-4 h-4 mr-1" />
                      Archive
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      <AnimatedModal
        isOpen={replyModal.isOpen}
        onClose={() => setReplyModal({ isOpen: false, contact: null })}
        title={`Reply to ${replyModal.contact?.name}`}
        type="info"
      >
        <div className="space-y-4">
          {replyModal.contact && (
            <>
              <div className="bg-card/50 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-white/60 mb-2">Original Message:</div>
                <div className="font-semibold text-white mb-1">{replyModal.contact.subject}</div>
                <p className="text-sm text-white/70">{replyModal.contact.message}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Your Reply</label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={6}
                  className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <AnimatedButton
                  onClick={sendReply}
                  disabled={!replyMessage.trim()}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => setReplyModal({ isOpen: false, contact: null })}
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
