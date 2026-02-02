'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirestore, useIsAdmin } from '@/firebase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, FileText } from 'lucide-react';

// Import Components - Support only (Reports & Messages)
import ReportsSection from './components/ReportsSection';
import ContactMessagesSection from './components/ContactMessagesSection';

type TabType = 'reports' | 'messages';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export default function SupportPage() {
  const { user, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('reports');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems: NavItem[] = [
    { id: 'reports', label: 'Reports', icon: FileText, description: 'User reports and violations' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, description: 'Contact messages & inquiries' },
  ];

  // Admin-only access control
  useEffect(() => {
    if (!initialized || adminLoading) return;
    
    if (!isAdmin) {
      const t = setTimeout(() => {
        router.replace('/dashboard/rides');
      }, 1000);
      return () => clearTimeout(t);
    }
    setLoading(false);
  }, [initialized, isAdmin, adminLoading, router]);

  // Loading state
  if (!initialized || adminLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-primary mx-auto"></div>
          <p className="text-slate-400">Loading support page...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!user || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You do not have permission to access this page.</p>
          <p className="text-sm text-slate-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'reports':
        return <ReportsSection />;
      case 'messages':
        return <ContactMessagesSection />;
      default:
        return <ReportsSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground">
      <div className="flex h-screen">
        {/* Sidebar Navigation */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 280 : 80 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-md border-r border-slate-700/50 overflow-hidden flex flex-col"
        >
          {/* Logo/Header */}
          <div className="p-4 border-b border-slate-700/50">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <div className="text-xl text-primary font-bold">
                {sidebarOpen ? 'Support' : 'S'}
              </div>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ x: sidebarOpen ? 5 : 0 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="text-sm font-medium text-left">{item.label}</span>
                )}
              </motion.button>
            ))}
          </nav>

          {/* User Info */}
          {sidebarOpen && (
            <div className="p-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-400">
                <div className="font-semibold text-slate-200 truncate">{user?.email}</div>
                <div className="text-slate-500 text-xs">Administrator</div>
              </div>
            </div>
          )}
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Top Header */}
          <div className="sticky top-0 z-40 border-b border-slate-700/50 bg-gradient-to-b from-slate-950/80 to-slate-900/80 backdrop-blur-md">
            <div className="px-6 py-4">
              <h1 className="text-2xl font-bold text-slate-50">
                {navItems.find(i => i.id === activeTab)?.label}
              </h1>
              <p className="text-sm text-slate-400">
                {navItems.find(i => i.id === activeTab)?.description}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>
    </div>
  );
}


