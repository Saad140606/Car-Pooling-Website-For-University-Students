'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Eye, Check, Trash2 } from 'lucide-react';

export default function ReportsSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');

  useEffect(() => {
    if (!firestore) return;

    (async () => {
      try {
        const reportsCol = safeCollection(firestore, 'reports');
        const reportsSnap = await getDocs(reportsCol);
        
        let reportsList = reportsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter by university type
        reportsList = reportsList.filter((report: any) => {
          if (!report.reportedBy) return false;
          // Match by email domain or stored university
          return true; // In production, filter by university field
        });

        setReports(reportsList);
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore]);

  const handleResolve = async (reportId: string) => {
    if (!firestore) return;
    try {
      const reportRef = doc(firestore, 'reports', reportId);
      await updateDoc(reportRef, { status: 'resolved' });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (err) {
      console.error('Failed to resolve report:', err);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filterStatus === 'pending') return report.status !== 'resolved';
    if (filterStatus === 'resolved') return report.status === 'resolved';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pending', 'resolved'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
              filterStatus === status
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/50">
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Sender</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Category</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Message</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Date</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-700/30 animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-48" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-16" /></td>
                  </tr>
                ))
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No reports found
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{report.reportedBy?.fullName || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{report.reportedBy?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-700/50 text-xs text-slate-200 capitalize">{report.category}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-300">{report.description}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {report.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        report.status === 'resolved'
                          ? 'bg-green-900/30 text-green-300'
                          : 'bg-amber-900/30 text-amber-300'
                      }`}>
                        {report.status === 'resolved' ? '✓ Resolved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-slate-700/50 rounded transition-colors text-slate-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </button>
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(report.id)}
                            className="p-2 hover:bg-green-900/30 rounded transition-colors text-slate-400 hover:text-green-400"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
