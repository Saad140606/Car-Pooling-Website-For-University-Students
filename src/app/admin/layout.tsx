"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  CheckSquare,
  Users,
  Car,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  Activity,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/Notification";

// ============================================================================
// ADMIN LAYOUT WITH PREMIUM NAVIGATION
// ============================================================================

const navigationItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: FileText,
    badge: 23,
    badgeVariant: "warning" as const,
  },
  {
    href: "/admin/contacts",
    label: "Contacts",
    icon: MessageSquare,
    badge: 67,
    badgeVariant: "error" as const,
  },
  {
    href: "/admin/approvals",
    label: "Approvals",
    icon: CheckSquare,
    badge: 12,
    badgeVariant: "warning" as const,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    badge: null,
  },
  {
    href: "/admin/rides",
    label: "Rides",
    icon: Car,
    badge: null,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    badge: null,
  },
];

const AdminNotificationBadge = () => {
  const notifications = [
    {
      id: "1",
      title: "New Report Submitted",
      message: "Report #R007 has been submitted",
      type: "warning" as const,
      timestamp: "2 min ago",
      unread: true,
    },
    {
      id: "2",
      title: "User Verification Pending",
      message: "3 new verification requests require review",
      type: "info" as const,
      timestamp: "10 min ago",
      unread: true,
    },
    {
      id: "3",
      title: "Payment Issue Resolved",
      message: "Report #R002 has been resolved",
      type: "success" as const,
      timestamp: "1 hour ago",
      unread: false,
    },
  ];

  return (
    <div className="relative">
      <NotificationCenter notifications={notifications} />
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Admin Panel</h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminNotificationBadge />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-72 z-40
          bg-gradient-to-b from-card/95 to-background/95 backdrop-blur-xl
          border-r border-white/10
          transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-white/10 animate-slide-in-down">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Campus Ride</h2>
                <p className="text-xs text-white/60">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-b border-white/10 space-y-2 animate-fade-slide-up">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">System Status</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-glow" />
                <span className="text-green-500 font-medium">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Active Users</span>
              <span className="text-white font-semibold tabular-nums">2,547</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Pending Actions</span>
              <Badge variant="warning" size="sm">
                102
              </Badge>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-1">
            {navigationItems.map((item, idx) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                    transition-all duration-300
                    stagger-item
                    ${
                      isActive
                        ? "bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 text-white shadow-glow"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }
                  `}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-300 ${
                        isActive ? "animate-subtle-bounce" : ""
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <Badge variant={item.badgeVariant || "secondary"} size="sm" pulse={item.badge > 0}>
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Admin Profile */}
          <div className="p-4 border-t border-white/10 animate-slide-up">
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-300"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold">
                  A
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white text-sm">Admin User</div>
                  <div className="text-xs text-white/60">admin@campusride.com</div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-white/60 transition-transform duration-300 ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl animate-scale-up">
                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-white/60" />
                    <span className="text-sm text-white">Settings</span>
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <Activity className="w-4 h-4 text-white/60" />
                    <span className="text-sm text-white">User Dashboard</span>
                  </Link>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 transition-colors border-t border-white/10">
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-20 lg:pt-0">
        {/* Desktop Header */}
        <div className="hidden lg:block sticky top-0 z-30 bg-card/70 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Activity className="w-4 h-4" />
                <span>Live</span>
              </div>
              <div className="w-px h-5 bg-white/10" />
              <div className="text-sm text-white/80">
                Last updated: <span className="font-semibold">Just now</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden xl:inline">Analytics</span>
                </button>
                <button className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="hidden xl:inline">Alerts</span>
                  <Badge variant="warning" size="sm">
                    5
                  </Badge>
                </button>
              </div>

              <AdminNotificationBadge />

              {/* Profile */}
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold">
                  A
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="animate-page-rise">{children}</div>
      </main>
    </div>
  );
}
