"use client";

import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Phone,
  Paperclip,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Eye,
  Archive,
  Trash2,
  MoreVertical,
  Download,
  Send,
  Mic,
  Image as ImageIcon,
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

type MessageType = "text" | "voice" | "file";
type MessageFilter = "all" | "text" | "voice" | "file" | "unread";

export default function AdminMessagesPage() {
  const analytics = useAdminAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<MessageFilter>("all");
  const [filterUniversity, setFilterUniversity] = useState<"all" | "fast" | "ned" | "karachi">("all");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  const mockChats = useMemo(() => {
    const chats = [
      {
        id: "chat1",
        user1: "Ahmed Hassan",
        user2: "Sara Ahmed",
        university: "FAST",
        lastMessage: "Thanks for the ride!",
        messageType: "text" as MessageType,
        timestamp: new Date(2026, 1, 4, 15, 30),
        unread: 2,
        totalMessages: 45,
      },
      {
        id: "chat2",
        user1: "Fatima Khan",
        user2: "Zain Khan",
        university: "NED",
        lastMessage: "[Voice Message]",
        messageType: "voice" as MessageType,
        timestamp: new Date(2026, 1, 4, 14, 15),
        unread: 0,
        totalMessages: 12,
      },
      {
        id: "chat3",
        user1: "Ali Raza",
        user2: "Maha Ali",
        university: "FAST",
        lastMessage: "[Shared Photo]",
        messageType: "file" as MessageType,
        timestamp: new Date(2026, 1, 4, 12, 45),
        unread: 1,
        totalMessages: 23,
      },
    ];

    return chats.filter((c) => {
      const matchesSearch =
        c.user1.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.user2.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        filterType === "all" ||
        (filterType === "unread" && c.unread > 0) ||
        (filterType === c.messageType);

      const matchesUniversity =
        filterUniversity === "all" ||
        (filterUniversity === "fast" && c.university === "FAST") ||
        (filterUniversity === "ned" && c.university === "NED");

      return matchesSearch && matchesType && matchesUniversity;
    });
  }, [searchTerm, filterType, filterUniversity]);

  const stats = {
    total: analytics.combined.messages.total,
    voice: analytics.combined.messages.voice,
    files: analytics.combined.messages.files,
  };

  if (analytics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - Chat List */}
        <div className="lg:col-span-1">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              Messages
            </h1>
            <p className="text-slate-400 text-sm">Monitor all conversations</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-400">{stats.total}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-purple-400">{stats.voice}</p>
              <p className="text-xs text-slate-400">Voice</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-400">{stats.files}</p>
              <p className="text-xs text-slate-400">Files</p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <FilterTag
                label="All"
                active={filterType === "all"}
                onClick={() => setFilterType("all")}
              />
              <FilterTag
                label="Text"
                active={filterType === "text"}
                onClick={() => setFilterType("text")}
              />
              <FilterTag
                label="Voice"
                active={filterType === "voice"}
                onClick={() => setFilterType("voice")}
              />
              <FilterTag
                label="Files"
                active={filterType === "file"}
                onClick={() => setFilterType("file")}
              />
            </div>

            <select
              value={filterUniversity}
              onChange={(e) => setFilterUniversity(e.target.value as "all" | "fast" | "ned" | "karachi")}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary transition-all"
            >
              <option value="all">All Universities</option>
              <option value="fast">FAST Only</option>
              <option value="ned">NED Only</option>
              <option value="karachi">Karachi Only</option>
            </select>
          </div>

          {/* Chat List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            {mockChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-all text-left ${
                  selectedChat === chat.id ? "bg-slate-800 border-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-white">{chat.user1}</p>
                    <p className="text-xs text-slate-400">with {chat.user2}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="px-2 py-1 bg-primary text-white text-xs rounded-full font-bold">
                      {chat.unread}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      chat.messageType === "voice"
                        ? "bg-purple-500/20 text-purple-300"
                        : chat.messageType === "file"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {chat.messageType === "voice" ? "🎤 Voice" : chat.messageType === "file" ? "📎 File" : "💬 Text"}
                  </span>
                  <span className="text-xs text-slate-500">{chat.totalMessages} messages</span>
                </div>
                <p className="text-sm text-slate-400 truncate">{chat.lastMessage}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {chat.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side - Chat View */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl h-full flex flex-col">
              {/* Chat Header */}
              <div className="border-b border-slate-800 p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Conversation Preview</h2>
                  <p className="text-sm text-slate-400">FAST University</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                    <Eye className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                    <Archive className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Sample messages */}
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-lg p-3 max-w-xs">
                    <p className="text-sm text-white">Are you available for a ride tomorrow?</p>
                    <p className="text-xs text-slate-400 mt-1">2:30 PM</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="bg-primary rounded-lg p-3 max-w-xs">
                    <p className="text-sm text-white">Yes, I am. What time?</p>
                    <p className="text-xs text-slate-200 mt-1">2:35 PM</p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-lg p-3 max-w-xs">
                    <p className="text-sm text-white">Around 3 PM from the library</p>
                    <p className="text-xs text-slate-400 mt-1">2:38 PM</p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-lg p-3 max-w-xs flex items-center gap-2">
                    <Mic className="w-4 h-4 text-purple-400" />
                    <p className="text-xs text-slate-400">[Voice Message - 1:23]</p>
                  </div>
                </div>
              </div>

              {/* Message Input */}
              <div className="border-t border-slate-800 p-4">
                <div className="flex items-center gap-3">
                  <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
                  />
                  <button className="p-2 bg-primary hover:bg-primary/80 rounded-lg transition-all text-white">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterTag({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-primary text-white"
          : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
