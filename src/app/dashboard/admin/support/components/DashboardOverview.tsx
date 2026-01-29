'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Users, Car, BookOpen, TrendingUp, Activity, BarChart3 } from 'lucide-react';

export default function DashboardOverview({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRides: 0,
    completedRides: 0,
    confirmedBookings: 0,
    activeRidestoday: 0,
    cancelledRides: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !universityType) return;

    (async () => {
      try {
        setLoading(true);

        // Get total users
        const usersRef = collection(firestore, 'universities', universityType, 'users');
        const usersSnap = await getDocs(usersRef);
        const totalUsers = usersSnap.size;

        // Get total rides
        const ridesRef = collection(firestore, 'universities', universityType, 'rides');
        const ridesSnap = await getDocs(ridesRef);
        const totalRides = ridesSnap.size;
        const completedRides = ridesSnap.docs.filter(doc => doc.data().status === 'completed').length;
        const cancelledRides = ridesSnap.docs.filter(doc => doc.data().status === 'cancelled').length;

        // Get active rides today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeRidesQuery = query(
          ridesRef,
          where('departureTime', '>=', today),
          where('status', '==', 'active')
        );
        const activeRidesSnap = await getDocs(activeRidesQuery);
        const activeRidesToday = activeRidesSnap.size;

        // Get confirmed bookings
        const bookingsRef = collection(firestore, 'universities', universityType, 'bookings');
        const bookingsQuery = query(bookingsRef, where('status', '==', 'CONFIRMED'));
        const bookingsSnap = await getDocs(bookingsQuery);
        const confirmedBookings = bookingsSnap.size;

        setStats({
          totalUsers,
          totalRides,
          completedRides,
          confirmedBookings,
          activeRidestoday: activeRidesToday,
          cancelledRides,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore, universityType]);

  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      change: '+12%',
      icon: Users,
      color: 'from-blue-600 to-blue-400',
    },
    {
      label: 'Total Rides',
      value: stats.totalRides,
      change: '+8%',
      icon: Car,
      color: 'from-purple-600 to-purple-400',
    },
    {
      label: 'Completed Rides',
      value: stats.completedRides,
      change: '+5%',
      icon: BarChart3,
      color: 'from-green-600 to-green-400',
    },
    {
      label: 'Confirmed Bookings',
      value: stats.confirmedBookings,
      change: '+15%',
      icon: BookOpen,
      color: 'from-orange-600 to-orange-400',
    },
    {
      label: 'Active Today',
      value: stats.activeRidestoday,
      change: '+3%',
      icon: Activity,
      color: 'from-pink-600 to-pink-400',
    },
    {
      label: 'Cancelled Rides',
      value: stats.cancelledRides,
      change: '-2%',
      icon: TrendingUp,
      color: 'from-red-600 to-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 transition-all duration-300 hover:border-slate-600 hover:shadow-xl hover:shadow-primary/10 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Animated gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

            {/* Content */}
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400 font-medium mb-1">{card.label}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-4xl font-bold text-white">
                      {loading ? (
                        <div className="h-10 w-20 bg-slate-700 rounded animate-pulse" />
                      ) : (
                        stats[Object.keys(stats)[idx] as keyof typeof stats]
                      )}
                    </h3>
                    <span className={`text-sm font-semibold ${card.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                      {card.change}
                    </span>
                  </div>
                </div>
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${card.color} transition-all duration-500`}
                  style={{ width: `${Math.min((stats[Object.keys(stats)[idx] as keyof typeof stats] / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
