'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirestore, useIsAdmin } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users, Zap, MessageSquare, FileText, TrendingUp, Settings, LogOut,
  BookOpen, LayoutDashboard, Building2, Shield, ChevronRight, Bell, Search,
  Menu, X, Home, Scale
} from 'lucide-react';

// Import Components
import UniversityBIDashboard from './components/UniversityBIDashboard';
import UniversityComparison from './components/UniversityComparison';
import ReportsSection from './components/ReportsSection';
import ContactMessagesSection from './components/ContactMessagesSection';
import UsersSection from './components/UsersSection';
import RidesSection from './components/RidesSection';
import BookingsSection from './components/BookingsSection';

type TabType = 'dashboard' | 'comparison' | 'reports' | 'messages' | 'users' | 'rides' | 'bookings';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export default function AdminPanel() {
  const { user, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const firestore = useFirestore();
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedUniversity, setSelectedUniversity] = useState<'all' | 'NED' | 'FAST'>('all');

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'BI Dashboard', icon: LayoutDashboard, description: 'University analytics & insights' },
    { id: 'comparison', label: 'Comparison', icon: Scale, description: 'Compare NED vs FAST' },
    { id: 'users', label: 'Users', icon: Users, description: 'User management' },
    { id: 'rides', label: 'Rides', icon: Zap, description: 'Ride management' },
    { id: 'bookings', label: 'Bookings', icon: BookOpen, description: 'Booking records' },
    { id: 'reports', label: 'Reports', icon: FileText, description: 'User reports' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'Contact messages' },
  ];

  useEffect(() => {
    if (!initialized || adminLoading) return;

    if (!user) {
      router.push('/auth/select-university');
      return;
    }

    if (!isAdmin) {
      router.push('/dashboard/rides');
      return;
    }

    // Fetch admin data
    (async () => {
      try {
        const adminRef = doc(firestore!, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);
        
        if (adminSnap.exists()) {
          setAdminData(adminSnap.data());
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        setLoading(false);
      }
    })();
  }, [user, initialized, isAdmin, adminLoading, firestore, router]);

  const handleSignOut = async () => {
    router.push('/');
  };

  // Loading state
  if (!initialized || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-slate-400 font-medium">Loading Admin Panel...</p>
          <p className="text-slate-500 text-sm mt-1">Verifying access permissions</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* ========== SIDEBAR ========== */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        className={`fixed lg:relative z-40 w-72 h-screen bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border-r border-slate-800/50 flex flex-col transition-all duration-300`}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-800/50">
          <Link href="/dashboard/rides" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Campus Ride
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-r-full"
                  />
                )}
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <div className="flex-1 text-left">
                  <span className="font-medium block">{item.label}</span>
                  <span className="text-[10px] text-slate-500 block">{item.description}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <Link
            href="/dashboard/rides"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
          >
            <Home className="h-5 w-5" />
            <span className="text-sm font-medium">Back to App</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed lg:hidden bottom-6 left-6 z-50 p-3 bg-primary rounded-full shadow-lg shadow-primary/30"
      >
        {sidebarOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
      </button>

      {/* ========== MAIN CONTENT ========== */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <motion.h2
                key={activeTab}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-white"
              >
                {navItems.find(item => item.id === activeTab)?.label}
              </motion.h2>
              <p className="text-slate-500 text-sm mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none outline-none text-sm text-slate-300 placeholder:text-slate-500 w-48"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Profile */}
              <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg shadow-primary/25">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-white">{user?.displayName || 'Admin'}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && <UniversityBIDashboard />}
              {activeTab === 'comparison' && <UniversityComparison />}
              {activeTab === 'reports' && <ReportsSection universityType={selectedUniversity === 'all' ? 'NED' : selectedUniversity} />}
              {activeTab === 'messages' && <ContactMessagesSection universityType={selectedUniversity === 'all' ? 'NED' : selectedUniversity} />}
              {activeTab === 'users' && <UsersSection universityType={selectedUniversity === 'all' ? 'NED' : selectedUniversity} />}
              {activeTab === 'rides' && <RidesSection universityType={selectedUniversity === 'all' ? 'NED' : selectedUniversity} />}
              {activeTab === 'bookings' && <BookingsSection universityType={selectedUniversity === 'all' ? 'NED' : selectedUniversity} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
