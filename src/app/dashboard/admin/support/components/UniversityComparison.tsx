'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';
import {
  Users, Car, Wallet, TrendingUp, Award, Building2, Scale
} from 'lucide-react';

interface UniversityComparisonData {
  id: string;
  name: string;
  shortName: string;
  color: string;
  totalUsers: number;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalEarnings: number;
  totalRequests: number;
  confirmedRequests: number;
  avgRidePrice: number;
}

export default function UniversityComparison() {
  const firestore = useFirestore();
  const [data, setData] = useState<UniversityComparisonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const fetchComparisonData = async () => {
      try {
        setLoading(true);
        const universities = ['NED', 'FAST'];
        const results: UniversityComparisonData[] = [];

        for (const uni of universities) {
          // Fetch users
          const usersRef = collection(firestore, `universities/${uni}/users`);
          const usersSnap = await getDocs(usersRef);
          const totalUsers = usersSnap.size;

          // Fetch rides
          const ridesRef = collection(firestore, `universities/${uni}/rides`);
          const ridesSnap = await getDocs(ridesRef);
          const totalRides = ridesSnap.size;
          
          let completedRides = 0;
          let cancelledRides = 0;
          let totalEarnings = 0;
          let totalPrices: number[] = [];

          ridesSnap.forEach(doc => {
            const d = doc.data();
            const status = (d.status || '').toLowerCase();
            const price = d.price || d.fare || 0;
            totalPrices.push(price);
            
            if (status === 'completed') {
              completedRides++;
              totalEarnings += price;
            } else if (status === 'cancelled') {
              cancelledRides++;
            }
          });

          // Fetch bookings
          const bookingsRef = collection(firestore, `universities/${uni}/bookings`);
          const bookingsSnap = await getDocs(bookingsRef);
          
          let totalRequests = bookingsSnap.size;
          let confirmedRequests = 0;

          bookingsSnap.forEach(doc => {
            const d = doc.data();
            const status = (d.status || '').toUpperCase();
            if (status === 'CONFIRMED' || status === 'ACCEPTED') {
              confirmedRequests++;
            }
          });

          const avgRidePrice = totalPrices.length > 0 
            ? totalPrices.reduce((a, b) => a + b, 0) / totalPrices.length 
            : 0;

          results.push({
            id: uni,
            name: uni === 'NED' ? 'NED University' : 'FAST University',
            shortName: uni,
            color: uni === 'NED' ? '#3b82f6' : '#8b5cf6',
            totalUsers,
            totalRides,
            completedRides,
            cancelledRides,
            totalEarnings,
            totalRequests,
            confirmedRequests,
            avgRidePrice: Math.round(avgRidePrice),
          });
        }

        setData(results);
      } catch (err) {
        console.error('Error fetching comparison data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [firestore]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-80 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const ned = data.find(d => d.id === 'NED');
  const fast = data.find(d => d.id === 'FAST');

  // Prepare comparison chart data
  const comparisonData = [
    { metric: 'Users', NED: ned?.totalUsers || 0, FAST: fast?.totalUsers || 0 },
    { metric: 'Rides', NED: ned?.totalRides || 0, FAST: fast?.totalRides || 0 },
    { metric: 'Completed', NED: ned?.completedRides || 0, FAST: fast?.completedRides || 0 },
    { metric: 'Requests', NED: ned?.totalRequests || 0, FAST: fast?.totalRequests || 0 },
    { metric: 'Confirmed', NED: ned?.confirmedRequests || 0, FAST: fast?.confirmedRequests || 0 },
  ];

  // Radar chart data (normalized)
  const maxValues = {
    users: Math.max(ned?.totalUsers || 1, fast?.totalUsers || 1),
    rides: Math.max(ned?.totalRides || 1, fast?.totalRides || 1),
    earnings: Math.max(ned?.totalEarnings || 1, fast?.totalEarnings || 1),
    requests: Math.max(ned?.totalRequests || 1, fast?.totalRequests || 1),
    avgPrice: Math.max(ned?.avgRidePrice || 1, fast?.avgRidePrice || 1),
  };

  const radarData = [
    { subject: 'Users', NED: ((ned?.totalUsers || 0) / maxValues.users) * 100, FAST: ((fast?.totalUsers || 0) / maxValues.users) * 100 },
    { subject: 'Rides', NED: ((ned?.totalRides || 0) / maxValues.rides) * 100, FAST: ((fast?.totalRides || 0) / maxValues.rides) * 100 },
    { subject: 'Earnings', NED: ((ned?.totalEarnings || 0) / maxValues.earnings) * 100, FAST: ((fast?.totalEarnings || 0) / maxValues.earnings) * 100 },
    { subject: 'Requests', NED: ((ned?.totalRequests || 0) / maxValues.requests) * 100, FAST: ((fast?.totalRequests || 0) / maxValues.requests) * 100 },
    { subject: 'Avg Price', NED: ((ned?.avgRidePrice || 0) / maxValues.avgPrice) * 100, FAST: ((fast?.avgRidePrice || 0) / maxValues.avgPrice) * 100 },
  ];

  const getLeader = (nedVal: number, fastVal: number) => {
    if (nedVal > fastVal) return 'NED';
    if (fastVal > nedVal) return 'FAST';
    return 'Tie';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-700/50">
        <Scale className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">University Comparison</h2>
          <p className="text-slate-400 text-sm">Side-by-side analytics comparison</p>
        </div>
      </div>

      {/* University Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.map((uni, idx) => (
          <motion.div
            key={uni.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-6"
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{ background: `linear-gradient(135deg, ${uni.color}20, transparent)` }}
            />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${uni.color}, ${uni.color}80)` }}
                >
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{uni.name}</h3>
                  <p className="text-sm text-slate-400">Complete Overview</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <Users className="h-5 w-5 text-blue-400 mb-2" />
                  <p className="text-2xl font-bold text-white">{uni.totalUsers.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Users</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <Car className="h-5 w-5 text-purple-400 mb-2" />
                  <p className="text-2xl font-bold text-white">{uni.totalRides.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Rides</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <Wallet className="h-5 w-5 text-green-400 mb-2" />
                  <p className="text-2xl font-bold text-white">PKR {uni.totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Earnings</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <TrendingUp className="h-5 w-5 text-amber-400 mb-2" />
                  <p className="text-2xl font-bold text-white">PKR {uni.avgRidePrice}</p>
                  <p className="text-xs text-slate-400">Avg Ride Price</p>
                </div>
              </div>

              {/* Completion Stats */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1 bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Completion Rate</span>
                    <span className="text-sm font-semibold text-green-400">
                      {uni.totalRides > 0 ? Math.round((uni.completedRides / uni.totalRides) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${uni.totalRides > 0 ? (uni.completedRides / uni.totalRides) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Confirm Rate</span>
                    <span className="text-sm font-semibold text-blue-400">
                      {uni.totalRequests > 0 ? Math.round((uni.confirmedRequests / uni.totalRequests) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${uni.totalRequests > 0 ? (uni.confirmedRequests / uni.totalRequests) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Metrics Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="metric" type="category" stroke="#64748b" width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="NED" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="FAST" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Performance Radar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" stroke="#94a3b8" />
              <PolarRadiusAxis stroke="#64748b" />
              <Radar name="NED" dataKey="NED" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Radar name="FAST" dataKey="FAST" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
              <Legend />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Leader Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl border border-slate-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          Category Leaders
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Most Users', ned: ned?.totalUsers || 0, fast: fast?.totalUsers || 0 },
            { label: 'Most Rides', ned: ned?.totalRides || 0, fast: fast?.totalRides || 0 },
            { label: 'Highest Earnings', ned: ned?.totalEarnings || 0, fast: fast?.totalEarnings || 0 },
            { label: 'Most Requests', ned: ned?.totalRequests || 0, fast: fast?.totalRequests || 0 },
            { label: 'Higher Avg Price', ned: ned?.avgRidePrice || 0, fast: fast?.avgRidePrice || 0 },
          ].map((cat, i) => {
            const leader = getLeader(cat.ned, cat.fast);
            return (
              <div key={i} className="bg-slate-900/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">{cat.label}</p>
                <div 
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    leader === 'NED' ? 'bg-blue-500/20 text-blue-400' :
                    leader === 'FAST' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  <Building2 className="h-3 w-3" />
                  {leader}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
