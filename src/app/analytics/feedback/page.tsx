'use client';

import React from 'react';
import { Download, Loader2, RefreshCw, MessageSquare } from 'lucide-react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';

interface FeedbackAnalyticsData {
  summary: {
    totalSubmissions: number;
    averageRating: number;
    byType: Record<string, number>;
    byUniversity: Record<string, number>;
    ratingDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  };
  trend: Array<{ date: string; count: number }>;
  recentResponses: Array<{
    id: string;
    university: string;
    type: string;
    rating: number;
    category: string;
    comment: string;
    submittedAt: string | null;
  }>;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function FeedbackAnalyticsPage() {
  const { user } = useUser();

  const [university, setUniversity] = React.useState<'all' | 'fast' | 'ned' | 'karachi'>('all');
  const [type, setType] = React.useState<'all' | 'first_ride' | 'app'>('all');
  const [days, setDays] = React.useState<'7' | '30' | '90'>('30');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<FeedbackAnalyticsData | null>(null);

  const fetchAnalytics = React.useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken(true);
      const query = new URLSearchParams({
        university,
        type,
        days,
      });

      const response = await fetch(`/api/admin/feedback-analytics?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load feedback analytics');
      }

      setData(payload as FeedbackAnalyticsData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load feedback analytics');
    } finally {
      setLoading(false);
    }
  }, [user, university, type, days]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportCsv = () => {
    if (!data) return;
    const rows: string[][] = [
      ['ID', 'University', 'Type', 'Rating', 'Category', 'Comment', 'Submitted At'],
      ...data.recentResponses.map((item) => [
        item.id,
        item.university,
        item.type,
        String(item.rating),
        item.category,
        item.comment,
        item.submittedAt || '',
      ]),
    ];

    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-analytics-${university}-${type}-${days}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-primary" />
              Feedback Analytics
            </h1>
            <p className="text-slate-400 mt-1">First-ride and app-feedback submissions with filtering and export.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={university}
              onChange={(event) => setUniversity(event.target.value as any)}
              className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm"
            >
              <option value="all">All Universities</option>
              <option value="fast">FAST</option>
              <option value="ned">NED</option>
              <option value="karachi">Karachi</option>
            </select>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as any)}
              className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm"
            >
              <option value="all">All Types</option>
              <option value="first_ride">First Ride</option>
              <option value="app">App Feedback</option>
            </select>
            <select
              value={days}
              onChange={(event) => setDays(event.target.value as any)}
              className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
            <Button onClick={exportCsv} disabled={!data}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm text-slate-400">Total Submissions</div>
                <div className="text-2xl font-semibold mt-1">{data.summary.totalSubmissions}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm text-slate-400">Average Rating</div>
                <div className="text-2xl font-semibold mt-1">{data.summary.averageRating.toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm text-slate-400">First-Ride Feedback</div>
                <div className="text-2xl font-semibold mt-1">{data.summary.byType.first_ride || 0}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm text-slate-400">App Feedback</div>
                <div className="text-2xl font-semibold mt-1">{data.summary.byType.app || 0}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-lg font-medium mb-3">Rating Distribution</h2>
                <div className="space-y-2">
                  {['5', '4', '3', '2', '1'].map((score) => {
                    const value = data.summary.ratingDistribution[score] || 0;
                    return (
                      <div key={score} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{score} Stars</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-lg font-medium mb-3">Top Categories</h2>
                <div className="space-y-2">
                  {Object.entries(data.summary.categoryDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate pr-2">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-lg font-medium mb-3">Daily Trend</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Submissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.map((item) => (
                      <tr key={item.date} className="border-b border-slate-900 last:border-0">
                        <td className="py-2 pr-4 text-slate-300">{item.date}</td>
                        <td className="py-2 pr-4">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-lg font-medium mb-3">Recent Responses</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="py-2 pr-4">University</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Rating</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentResponses.map((item) => (
                      <tr key={item.id} className="border-b border-slate-900 last:border-0">
                        <td className="py-2 pr-4 uppercase text-slate-300">{item.university}</td>
                        <td className="py-2 pr-4">{item.type}</td>
                        <td className="py-2 pr-4">{item.rating}</td>
                        <td className="py-2 pr-4">{item.category}</td>
                        <td className="py-2 pr-4 max-w-[420px] truncate text-slate-300">{item.comment || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
