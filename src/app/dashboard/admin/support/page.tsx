'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { BarChart3, Users, Zap, MessageSquare, FileText, TrendingUp, Settings, LogOut, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardOverview from './components/DashboardOverview';
import AnalyticsSection from './components/AnalyticsSection';
import ReportsSection from './components/ReportsSection';
import ContactMessagesSection from './components/ContactMessagesSection';
import UsersSection from './components/UsersSection';
import RidesSection from './components/RidesSection';
import BookingsSection from './components/BookingsSection';

type TabType = 'overview' | 'analytics' | 'reports' | 'messages' | 'users' | 'rides' | 'bookings';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className: string }>;
}

export default function AdminPanel() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'rides', label: 'Rides', icon: Zap },
    { id: 'bookings', label: 'Bookings', icon: BookOpen },
  ];

  useEffect(() => {
    if (!user || !firestore) {
      router.push('/auth/select-university');
      return;
    }

    // Verify admin access
    (async () => {
      try {
        const adminRef = doc(firestore, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);
        
        if (!adminSnap.exists()) {
          router.push('/dashboard/rides');
          return;
        }

        setAdminData(adminSnap.data());
        setLoading(false);
      } catch (err) {
        console.error('Failed to verify admin access:', err);
        router.push('/dashboard/rides');
      }
    })();
  }, [user, firestore, router]);

  const handleSignOut = async () => {
    // Sign out logic here
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-accent animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-md border-r border-slate-700/50 flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Campus Ride
          </h1>
          <p className="text-xs text-slate-400 mt-1">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-primary/25 to-accent/10 text-primary shadow-lg shadow-primary/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 space-y-2">
          <Link
            href="/dashboard/account"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
            <span className="text-sm">Settings</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-red-900/30 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">
                {navItems.find(item => item.id === activeTab)?.label}
              </h2>
              <p className="text-slate-400 mt-1">
                {adminData?.universityType === 'FAST' ? 'FAST University' : 'NED University'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <span className="text-sm text-slate-400">{user?.email}</span>
            </div>
          </div>

          {/* Content */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'overview' && <DashboardOverview universityType={adminData?.universityType} />}
            {activeTab === 'analytics' && <AnalyticsSection universityType={adminData?.universityType} />}
            {activeTab === 'reports' && <ReportsSection universityType={adminData?.universityType} />}
            {activeTab === 'messages' && <ContactMessagesSection universityType={adminData?.universityType} />}
            {activeTab === 'users' && <UsersSection universityType={adminData?.universityType} />}
            {activeTab === 'rides' && <RidesSection universityType={adminData?.universityType} />}
            {activeTab === 'bookings' && <BookingsSection universityType={adminData?.universityType} />}
          </div>
        </div>
      </main>
    </div>
  );
}
