"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";
import {
  MessageSquare,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Eye,
  Archive,
  Trash2,
  MoreVertical,
  Download,
  RefreshCw,
  Loader2,
  Mail,
  Shield,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type MessageStatus = "all" | "unread" | "read" | "archived";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  university?: string;
  message: string;
  status: string;
  createdAt: string;
  uid?: string;
}

export default function AdminMessagesPage() {
  // 🔒 SECURITY: Verify admin authentication
  const { loading: authLoading, isAdmin, error: authError } = useAdminAuth();
  
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<MessageStatus>("all");
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError('Not authenticated');
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/contact-messages?limit=200', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.error('Not authenticated');
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/contact-messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ messageId, status: 'read' }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'read' } : m));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };
  const filteredMessages = useMemo(() => {
    return messages
      .filter((m) => {
        const matchesSearch =
          m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.message?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" || m.status === filterStatus;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, searchTerm, filterStatus]);

  const stats = useMemo(() => ({
    total: messages.length,
    unread: messages.filter(m => m.status === 'unread').length,
    read: messages.filter(m => m.status === 'read').length,
    archived: messages.filter(m => m.status === 'archived').length,
  }), [messages]);

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
          <p className="text-slate-400">Loading messages...</p>
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
              <Mail className="w-10 h-10 text-primary" />
              Contact Messages
            </h1>
            <p className="text-slate-400">Review and respond to contact form submissions</p>
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
        <StatBox label="Total Messages" value={stats.total} color="blue" icon={MessageSquare} />
        <StatBox label="Unread" value={stats.unread} color="yellow" icon={Clock} />
        <StatBox label="Read" value={stats.read} color="green" icon={CheckCircle} />
        <StatBox label="Archived" value={stats.archived} color="gray" icon={Archive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Messages List */}
        <div className="lg:col-span-2">
          {/* Filters & Search */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Search Messages
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Name, email, message..."
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
                  onChange={(e) => setFilterStatus(e.target.value as MessageStatus)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-primary transition-all"
                >
                  <option value="all">All Messages</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Messages List */}
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No messages found</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg.id)}
                  className={`bg-slate-900/50 border rounded-xl p-6 cursor-pointer transition-all hover:border-primary ${
                    selectedMessage === msg.id ? "border-primary bg-slate-800/50" : "border-slate-800"
                  } ${msg.status === 'unread' ? 'bg-blue-500/5' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-bold text-white">{msg.name}</h3>
                        {msg.status === 'unread' && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full font-semibold">
                            New
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-slate-400">Email</p>
                          <p className="text-sm text-white font-medium">{msg.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">University</p>
                          <p className="text-sm text-white font-medium">
                            {msg.university || 'Not specified'}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-xs text-slate-400 mb-1">Message</p>
                        <p className="text-sm text-slate-300 line-clamp-2">{msg.message}</p>
                      </div>

                      <p className="text-xs text-slate-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(msg.id);
                        }}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
                        title="Mark as read"
                      >
                        <CheckCircle className="w-5 h-5" />
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

        {/* Right Side - Message Detail */}
        <div className="lg:col-span-1">
          {selectedMessage ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sticky top-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                Message Details
              </h2>
              
              {(() => {
                const msg = messages.find(m => m.id === selectedMessage);
                if (!msg) return null;
                
                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">From</p>
                      <p className="text-sm font-bold text-white">{msg.name}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Email</p>
                      <p className="text-sm text-white">{msg.email}</p>
                    </div>

                    {msg.university && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">University</p>
                        <p className="text-sm text-white">{msg.university}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        msg.status === 'unread' 
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : msg.status === 'read'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Received</p>
                      <p className="text-sm text-white">
                        {new Date(msg.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-2">Full Message</p>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-4">
                      <button 
                        onClick={() => handleMarkAsRead(msg.id)}
                        disabled={msg.status === 'read'}
                        className="w-full px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Read
                      </button>
                      <button className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all flex items-center justify-center gap-2">
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                      <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all flex items-center justify-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <Mail className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// StatBox component
function StatBox({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
    green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
    gray: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" },
  };

  const c = colors[color] || colors.blue;

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
