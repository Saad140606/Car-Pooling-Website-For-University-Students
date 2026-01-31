"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useIsAdmin } from '@/firebase';
import { query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [accessDenied, setAccessDenied] = useState(false);

  // CRITICAL: Admin-only access control
  useEffect(() => {
    // Wait for all checks to complete
    if (!initialized || adminLoading) return;
    
    // If check is complete and user is NOT admin, deny access
    if (!isAdmin) {
      setAccessDenied(true);
      // Redirect after a brief moment to show the message
      const t = setTimeout(() => {
        router.replace('/dashboard/rides');
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [initialized, isAdmin, adminLoading, router]);

  // If access denied, show error
  if (accessDenied) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You do not have permission to access the admin panel.</p>
          <p className="text-sm text-slate-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show loading state while checking admin status
  if (!initialized || adminLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-primary mx-auto"></div>
          <p className="text-slate-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const [reports, setReports] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const formatPerson = (obj: any) => {
    if (!obj) return null;
    // common shapes: { uid, name, email, university }, or { userId, displayName }, or flat strings
    const name = obj.name || obj.displayName || obj.fullName || obj.username || obj.userName || obj.subject || null;
    const email = obj.email || obj.userEmail || obj.contactEmail || null;
    const uid = obj.uid || obj.userId || obj.id || null;
    const university = obj.university || obj.univ || null;
    if (name || email || uid || university) return { name, email, uid, university, raw: obj };
    return null;
  };

  const personFromReport = (r: any) => {
    return formatPerson(r.submittedBy) || formatPerson(r.submittedUser) || formatPerson(r.reportedBy) || formatPerson(r.createdBy) || null;
  };

  const personFromMessage = (m: any) => {
    // message may be flat or nested
    if (!m) return null;
    if (m.name || m.email || m.uid) return { name: m.name || null, email: m.email || null, uid: m.uid || null, raw: m };
    if (m.from) return formatPerson(m.from) || { name: String(m.from) };
    if (m.sender) return formatPerson(m.sender) || { name: String(m.sender) };
    return null;
  };

  useEffect(() => {
    if (!db || !isAdmin) return;
    const reportsCol = safeCollection(db, 'reports');
    const q = query(reportsCol, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows: any[] = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      setReports(rows);
      setLoadingReports(false);
      setReportsError(null);
    }, (err) => { console.warn('reports snapshot error', err); setLoadingReports(false); });

    const msgsCol = safeCollection(db, 'contact_messages');
    const q2 = query(msgsCol, orderBy('createdAt', 'desc'));
    const unsub2 = onSnapshot(q2, (snap) => {
      const rows: any[] = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      setMessages(rows);
      setLoadingMessages(false);
      setMessagesError(null);
    }, (err) => { console.warn('contact_messages snapshot error', err); setLoadingMessages(false); });

    return () => { unsub(); unsub2(); };
  }, [db, isAdmin]);

  // Do not expose admin UI until admin check finishes
  if (adminLoading || !initialized) return null;

  // If not admin, show safe denied message; suppress debug info in production
  if (!user || !isAdmin) {
    const isProd = process.env.NODE_ENV === 'production';
    return (
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">Administrator access is required to view this page.</p>
          {!isProd && (
            <div className="mt-4 text-sm text-muted-foreground">
              <div>Signed-in user: <strong>{user?.email || 'not signed in'}</strong></div>
              <div>UID: <strong>{user?.uid || '(unknown)'}</strong></div>
              <div>isAdmin: <strong>{String(isAdmin)}</strong></div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Debug panel for admins to help diagnose empty lists / permission issues
  const DebugPanel = () => (
    <Card className="p-4 mb-8 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg shadow-primary/5">
      <div className="text-sm text-slate-300 font-semibold">Account: <span className="text-primary">{user?.email}</span> • UID: <span className="text-primary">{user?.uid}</span> • Admin: <span className="text-accent">{String(isAdmin)}</span></div>
      <div className="text-sm text-slate-400 mt-2">📊 Reports: <strong className="text-slate-200">{reports.length}</strong> {reportsError ? ` ⚠️ (error: ${reportsError})` : ''}</div>
      <div className="text-sm text-slate-400">💬 Messages: <strong className="text-slate-200">{messages.length}</strong> {messagesError ? ` ⚠️ (error: ${messagesError})` : ''}</div>
    </Card>
  );

  const changeReportStatus = async (id: string, status: string, adminNotes?: string) => {
    if (!db) return;
    try {
      const ref = doc(db, 'reports', id);
      await updateDoc(ref, { status, adminNotes: adminNotes ?? '' });
    } catch (e) { console.error(e); }
  };

  const changeMessageStatus = async (id: string, status: string) => {
    if (!db) return;
    try {
      const ref = doc(db, 'contact_messages', id);
      await updateDoc(ref, { status });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="section-shell py-8 relative z-10">
        <div className="mb-6 sm:mb-8 animate-page">
          <h1 className="text-4xl font-headline font-bold text-slate-50 mb-2">Admin Dashboard</h1>
          <p className="text-slate-300">Manage reports, messages, and user moderation</p>
        </div>

        <DebugPanel />
        <section className="mb-8 sm:mb-12 animate-slide-in-down" style={{ animationDelay: '0.1s' }}>
          <div className="mb-6">
            <h2 className="text-2xl font-headline font-bold text-slate-50 mb-1">Reported Issues</h2>
            <p className="text-slate-400 text-sm">User reports and policy violations</p>
          </div>
          {loadingReports ? (
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md text-center shadow-lg shadow-primary/5">
              <div className="text-slate-300 inline-block animate-spin">⏳</div>
              <p className="mt-2 text-slate-300">Loading reports...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-800/40 via-slate-800/30 to-slate-900/40 backdrop-blur-md text-center">
                  <p className="text-slate-400">✨ No reports at this time</p>
                </div>
              ) : (
                reports.map((r, idx) => (
                  <Card key={r.id} className="p-6 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: `${0.15 + idx * 0.05}s` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="inline-flex items-center gap-2 mb-2">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">{r.category || 'Report'}</span>
                          <span className="text-xs text-slate-400">{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'Unknown date'}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-50">{r.subject || 'No subject'}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${r.status === 'action_taken' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : r.status === 'reviewed' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
                        {r.status === 'action_taken' ? '✓ Action Taken' : r.status === 'reviewed' ? '👁️ Reviewed' : '⏳ Pending'}
                      </span>
                    </div>

                    {(() => {
                      const p = personFromReport(r);
                      if (p) {
                        return (
                          <div className="text-sm text-slate-300 mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-primary">👤</span>
                              <strong className="text-slate-200">{p.name || p.uid || p.email || 'Unknown'}</strong>
                              {p.university && <span className="text-slate-400 text-xs">• {p.university}</span>}
                            </div>
                            {p.email && <div className="text-xs text-slate-400">📧 {p.email}</div>}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {r.reportedUser && (
                      <div className="text-sm text-slate-300 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2">
                          <span className="text-red-400">🚩</span>
                          <strong className="text-slate-200">Against: {r.reportedUser.name || r.reportedUser.uid || r.reportedUser.email}</strong>
                        </div>
                      </div>
                    )}

                    {r.rideId && (
                      <div className="text-sm text-slate-300 mb-3 p-2 rounded bg-slate-800/40">
                        <strong className="text-slate-200">Ride:</strong> {r.rideId}
                      </div>
                    )}

                    <div className="text-slate-300 text-sm mb-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
                      {r.description}
                    </div>

                    {r.evidenceUrl && (
                      <div className="mb-4">
                        <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:text-primary/80 transition-colors">
                          📎 View Evidence
                        </a>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={() => changeReportStatus(r.id, 'reviewed')} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">
                          Mark Reviewed
                        </Button>
                        <Button onClick={() => changeReportStatus(r.id, 'action_taken')} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">
                          Action Taken
                        </Button>
                        <Button onClick={() => changeReportStatus(r.id, 'pending')} variant="outline" className="border-border/40" size="sm">
                          Set Pending
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-200 block mb-2">Admin Notes</label>
                        <Textarea 
                          defaultValue={r.adminNotes || ''} 
                          onBlur={async (e) => { await changeReportStatus(r.id, r.status || 'pending', e.currentTarget.value); }}
                          className="border-border/40 bg-background/60 backdrop-blur-sm text-slate-200 text-sm resize-none"
                          rows={2}
                          placeholder="Add internal notes..."
                        />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>

        <section className="animate-slide-in-down" style={{ animationDelay: '0.2s' }}>
          <div className="mb-6">
            <h2 className="text-2xl font-headline font-bold text-slate-50 mb-1">Contact Messages</h2>
            <p className="text-slate-400 text-sm">User inquiries and feedback</p>
          </div>
          {loadingMessages ? (
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md text-center shadow-lg shadow-primary/5">
              <div className="text-slate-300 inline-block animate-spin">⏳</div>
              <p className="mt-2 text-slate-300">Loading messages...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-800/40 via-slate-800/30 to-slate-900/40 backdrop-blur-md text-center">
                  <p className="text-slate-400">✨ No messages at this time</p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <Card key={m.id} className="p-6 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: `${0.25 + idx * 0.05}s` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {m.category && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30">{m.category}</span>}
                          <span className="text-xs text-slate-400">{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : 'Unknown date'}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-50">{m.subject || 'No subject'}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${m.status === 'responded' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : m.status === 'seen' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
                        {m.status === 'responded' ? '✓ Responded' : m.status === 'seen' ? '👁️ Seen' : '📩 New'}
                      </span>
                    </div>

                    {(() => {
                      const pm = personFromMessage(m);
                      if (pm) return (
                        <div className="text-sm text-slate-300 mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                          <div className="flex items-center gap-2 mb-1">
                            <span>👤</span>
                            <strong className="text-slate-200">{pm.name || pm.uid || pm.email || 'Unknown'}</strong>
                          </div>
                          {pm.email && <div className="text-xs text-slate-400">📧 {pm.email}</div>}
                        </div>
                      );
                      if (m.name || m.email || m.uid) return (
                        <div className="text-sm text-slate-300 mb-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                          <strong className="text-slate-200">{m.name || m.email || m.uid}</strong>
                          {m.email && <div className="text-xs text-slate-400">📧 {m.email}</div>}
                        </div>
                      );
                      return null;
                    })()}

                    <div className="text-slate-300 text-sm mb-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
                      {m.message}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => changeMessageStatus(m.id, 'seen')} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">
                        Mark Seen
                      </Button>
                      <Button onClick={() => changeMessageStatus(m.id, 'responded')} className="shadow-lg shadow-primary/30 hover:shadow-primary/50" size="sm">
                        Mark Responded
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
