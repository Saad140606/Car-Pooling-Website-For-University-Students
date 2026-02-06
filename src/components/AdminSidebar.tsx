"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Users,
  Car,
  FileText,
  MessageSquare,
  AlertTriangle,
  Settings,
  LogOut,
  ChevronRight,
  BarChart3,
  Home,
} from "lucide-react";
import { getAuth, signOut } from "firebase/auth";

const navItems = [
  { icon: Home, label: "Overview", href: "/admin-dashboard", badge: null },
  { icon: Users, label: "Users", href: "/admin-dashboard/users", badge: null },
  { icon: Car, label: "Rides", href: "/admin-dashboard/rides", badge: null },
  { icon: FileText, label: "Bookings", href: "/admin-dashboard/bookings", badge: null },
  { icon: MessageSquare, label: "Messages", href: "/admin-dashboard/messages", badge: null },
  { icon: AlertTriangle, label: "Reports", href: "/admin-dashboard/reports", badge: "3" },
  { icon: BarChart3, label: "Analytics", href: "/admin-dashboard/analytics", badge: null },
];

const settingsItems = [
  { icon: Settings, label: "Settings", href: "/admin-dashboard/settings" },
];

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function AdminSidebar({ collapsed, mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      router.push('/admin-login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isActive = (href: string) => {
    if (href === "/admin-dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-700 z-50 transform transition-transform duration-300 lg:translate-x-0 shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className={`${collapsed ? "lg:hidden" : ""}`}>
                <h1 className="text-xl font-bold text-white">Campus Ride</h1>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`font-medium flex-1 ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  {item.badge && !collapsed && (
                    <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                  {active && !collapsed && <ChevronRight className="w-4 h-4" />}
                </Link>
              );
            })}
          </nav>

          {/* Settings & Logout */}
          <div className="border-t border-slate-800 p-4 space-y-2">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    active
                      ? "bg-primary text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className={`font-medium ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className={`font-medium ${collapsed ? "lg:hidden" : ""}`}>Logout</span>
            </button>
          </div>

          {/* User Info */}
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">AD</span>
              </div>
              <div className={`flex-1 min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-sm font-medium text-white truncate">Admin User</p>
                <p className="text-xs text-slate-400 truncate">admin@campus-ride.com</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
