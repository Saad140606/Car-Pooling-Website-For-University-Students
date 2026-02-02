'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Eye, Check, Trash2, AlertCircle, RefreshCw, FileText } from 'lucide-react';

export default function ReportsSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    setError(null);

    // Use real-time listener for reports
    const reportsCol = safeCollection(firestore, 'reports');
    
    const unsubscribe = onSnapshot(
      reportsCol,
      (snapshot) => {
        console.log('[ReportsSection] Snapshot received:', snapshot.size, 'reports');
        
        const reportsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setReports(reportsList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[ReportsSection] Failed to fetch reports:', err);
        setError(`Failed to load reports: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  const handleResolve = async (reportId: string) => {
    if (!firestore) return;
    try {
      const reportRef = doc(firestore, 'reports', reportId);
      await updateDoc(reportRef, { status: 'resolved' });
      // State will auto-update via onSnapshot listener
    } catch (err: any) {
      console.error('[ReportsSection] Failed to resolve report:', err);
      alert(`Failed to resolve report: ${err.message}`);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filterStatus === 'pending') return report.status !== 'resolved' && report.status !== 'action_taken';
    if (filterStatus === 'resolved') return report.status === 'resolved' || report.status === 'action_taken';
    return true;
  });

  // Error state UI
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

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
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No reports found</p>
                    <p className="text-xs text-slate-500 mt-1">User reports will appear here when submitted</p>
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
