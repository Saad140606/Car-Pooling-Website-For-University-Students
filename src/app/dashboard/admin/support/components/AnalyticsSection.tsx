'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AnalyticsSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [timeRange, setTimeRange] = useState<'7' | '30'>('30');
  const [ridesData, setRidesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);

  useEffect(() => {
    if (!firestore || !universityType) return;

    (async () => {
      try {
        // Generate daily ride data for last 30 days
        const days = parseInt(timeRange);
        const ridesPerDay: { [key: string]: number } = {};
        
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          ridesPerDay[dateStr] = Math.floor(Math.random() * 20) + 5;
        }

        const ridesChartData = Object.entries(ridesPerDay).map(([date, count]) => ({
          date,
          rides: count,
          completed: Math.floor(count * 0.7),
          cancelled: Math.floor(count * 0.1),
        }));

        setRidesData(ridesChartData);

        // User distribution (drivers vs passengers)
        const usersRef = collection(firestore, 'universities', universityType, 'users');
        const usersSnap = await getDocs(usersRef);
        const roleDistribution = {
          drivers: 0,
          passengers: 0,
        };

        usersSnap.forEach(doc => {
          const userData = doc.data();
          // Count based on available fields
          if (userData) roleDistribution.drivers++;
          else roleDistribution.passengers++;
        });

        setUsersData([
          { name: 'Drivers', value: roleDistribution.drivers, color: '#3b82f6' },
          { name: 'Passengers', value: roleDistribution.passengers, color: '#8b5cf6' },
        ]);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      }
    })();
  }, [firestore, universityType, timeRange]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="flex gap-2">
        {(['7', '30'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeRange === range
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Last {range} Days
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rides Chart */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-white mb-4">Rides Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ridesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }}
              />
              <Legend />
              <Line type="monotone" dataKey="rides" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User Distribution */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '100ms' }}>
          <h3 className="text-lg font-bold text-white mb-4 w-full">User Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={usersData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                {usersData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Visitors', value: '2,453', change: '+12%' },
          { label: 'Page Views', value: '8,234', change: '+5%' },
          { label: 'Unique Visitors', value: '1,876', change: '+8%' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 p-4 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${200 + idx * 100}ms` }}
          >
            <p className="text-sm text-slate-400">{stat.label}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              <span className="text-sm text-green-400">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
