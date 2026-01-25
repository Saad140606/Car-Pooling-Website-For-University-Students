"use client";
import React, { useEffect, useState } from 'react';
import { useUser, useFirestore, useIsAdmin } from '@/firebase';
import { query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const db = useFirestore();
  const { user, initialized } = useUser();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

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
    <Card className="p-3 mb-4">
      <div className="text-sm text-muted-foreground">Signed-in: <strong>{user?.email}</strong> • UID: <strong>{user?.uid}</strong> • isAdmin: <strong>{String(isAdmin)}</strong></div>
      <div className="text-sm mt-2">Reports: {reports.length} {reportsError ? ` (error: ${reportsError})` : ''}</div>
      <div className="text-sm">Messages: {messages.length} {messagesError ? ` (error: ${messagesError})` : ''}</div>
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
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Reports</h2>
        {loadingReports ? <div>Loading reports...</div> : (
          <div className="space-y-3">
            {reports.map(r => (
              <Card key={r.id} className="p-3">
                <div className="text-sm text-muted-foreground">{r.category} • {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : ''}</div>
                {(() => {
                  const p = personFromReport(r);
                  if (p) {
                    return (
                      <div className="text-sm text-muted-foreground mt-1">Submitted by: <strong>{p.name || p.uid || p.email}</strong>{p.university ? ` • ${p.university}` : ''}{p.email ? ` • ${p.email}` : ''}</div>
                    );
                  }
                  // fallback: show raw submittedBy if present
                  if (r.submittedBy) return (<pre className="text-xs text-muted-foreground mt-1 p-2 bg-muted/5 rounded">{JSON.stringify(r.submittedBy)}</pre>);
                  return null;
                })()}

                {r.reportedUser && (
                  <div className="text-sm text-muted-foreground">Against: <strong>{r.reportedUser.name || r.reportedUser.uid || r.reportedUser.email}</strong></div>
                )}
                {r.rideId && (
                  <div className="text-sm text-muted-foreground">Ride: <strong>{r.rideId}</strong></div>
                )}
                <div className="font-medium mt-1">{r.subject || 'No subject'}</div>
                <div className="text-sm mt-1">{r.description}</div>
                {r.evidenceUrl && <div className="mt-2"><a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="underline">Evidence</a></div>}
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => changeReportStatus(r.id, 'reviewed')}>Mark Reviewed</Button>
                  <Button onClick={() => changeReportStatus(r.id, 'action_taken')}>Mark Action Taken</Button>
                  <Button onClick={() => changeReportStatus(r.id, 'pending')}>Set Pending</Button>
                </div>
                <div className="mt-2">
                  <label className="text-sm">Admin notes</label>
                  <Textarea defaultValue={r.adminNotes || ''} onBlur={async (e) => { await changeReportStatus(r.id, r.status || 'pending', e.currentTarget.value); }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Contact Messages</h2>
        {loadingMessages ? <div>Loading messages...</div> : (
          <div className="space-y-3">
            {messages.map(m => (
              <Card key={m.id} className="p-3">
                <div className="text-sm text-muted-foreground">{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ''}</div>
                {(() => {
                  const pm = personFromMessage(m);
                  if (pm) return (<div className="text-sm text-muted-foreground mt-1">From: <strong>{pm.name || pm.uid || pm.email || 'Unknown'}</strong>{pm.email ? ` • ${pm.email}` : ''}{pm.uid ? ` • ${pm.uid}` : ''}</div>);
                  if (m.name || m.email || m.uid) return (<div className="text-sm text-muted-foreground mt-1">From: <strong>{m.name || m.email || m.uid}</strong>{m.email ? ` • ${m.email}` : ''}{m.uid ? ` • ${m.uid}` : ''}</div>);
                  return (<pre className="text-xs text-muted-foreground mt-1 p-2 bg-muted/5 rounded">{JSON.stringify(m)}</pre>);
                })()}
                <div className="font-medium mt-1">{m.subject || ''}</div>
                <div className="text-sm mt-1">{m.message}</div>
                {m.category && <div className="text-xs text-muted-foreground mt-1">Category: {m.category}</div>}
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => changeMessageStatus(m.id, 'seen')}>Mark Seen</Button>
                  <Button onClick={() => changeMessageStatus(m.id, 'responded')}>Mark Responded</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
