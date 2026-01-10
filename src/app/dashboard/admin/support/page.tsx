"use client";
import React, { useEffect, useState } from 'react';
import { useFirestore, useUser, useIsAdmin } from '@/firebase';
import { useRouter } from 'next/navigation';
import { query, where, onSnapshot, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateReportStatus, updateContactStatus } from '@/firebase/firestore/support';

export default function AdminSupportPage() {
  const db = useFirestore();
  const { user, initialized } = useUser();
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [reports, setReports] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !isAdmin) return;
    const reportsCol = safeCollection(db, 'reports');
    const q = query(reportsCol, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows: any[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setReports(rows);
      setLoading(false);
    }, (err) => { console.warn('reports snapshot error', err); setLoading(false); });
    const msgsCol = safeCollection(db, 'contact_messages');
    const q2 = query(msgsCol, orderBy('createdAt', 'desc'));
    const unsub2 = onSnapshot(q2, (snap) => {
      const rows: any[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setMessages(rows);
    }, (err) => { console.warn('contact_messages snapshot error', err); });
    return () => { unsub(); unsub2(); };
  }, [db, isAdmin]);

  useEffect(() => {
    // After auth and admin check are initialized, do NOT auto-redirect —
    // show debug info so we can diagnose why `isAdmin` is false.
    // (Previously this redirected to /unauthorized and made debugging hard.)
    // Keep this effect intentionally no-op.
  }, [initialized, adminLoading, user, isAdmin, router]);

  // Do not redirect while the admin check is still loading; show nothing
  // (or a spinner) to avoid cancelling verification.
  if (adminLoading) return null;

  // Show diagnostic UI when not admin so we can inspect values.
  if (!user || !isAdmin) {
    const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-2xl">Admin access required</h2>
        <div>Signed-in user: <strong>{user?.email || 'not signed in'}</strong></div>
        <div>Signed-in UID: <strong>{user?.uid || '(unknown)'}</strong></div>
        <div>Configured admin emails: <strong>{envAdmins.join(', ') || '(none)'}</strong></div>
        <div>isAdmin: <strong>{String(isAdmin)}</strong></div>
        <div>initialized: <strong>{String(initialized)}</strong> adminLoading: <strong>{String(adminLoading)}</strong></div>
        <div className="pt-2">If your email is listed above, try refreshing the page.</div>
        <div className="pt-2">
          <button className="btn" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      </div>
    );
  }


  const changeReportStatus = async (id: string, status: string) => {
    if (!db) return;
    try { await updateReportStatus(db, id, { status: status as any }); } catch (e) { console.error(e); }
  };

  const changeMessageStatus = async (id: string, status: string) => {
    if (!db) return;
    try { await updateContactStatus(db, id, { status: status as any }); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl">Support Inbox (Admin)</h2>
      <section>
        <h3 className="text-lg mb-2">Reports</h3>
        {loading ? <div>Loading...</div> : reports.map(r => (
          <div key={r.id} className="p-3 border rounded mb-2">
            <div className="text-sm text-muted-foreground">{r.reportType} • {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : ''}</div>
            <div className="font-medium">{r.subject || 'No subject'}</div>
            <div className="text-sm">{r.description}</div>
            {r.evidenceUrl && <div><a href={r.evidenceUrl} target="_blank" rel="noreferrer">Evidence</a></div>}
            <div className="mt-2 flex gap-2">
              <Button onClick={() => changeReportStatus(r.id, 'in_review')}>Mark In Review</Button>
              <Button onClick={() => changeReportStatus(r.id, 'resolved')}>Resolve</Button>
              <Button onClick={() => changeReportStatus(r.id, 'rejected')}>Reject</Button>
            </div>
            {r.adminNotes && <div className="mt-2 text-xs text-muted-foreground">Admin: {r.adminNotes}</div>}
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-lg mb-2">Contact Messages</h3>
        {messages.map(m => (
          <div key={m.id} className="p-3 border rounded mb-2">
            <div className="text-sm text-muted-foreground">{m.category} • {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ''}</div>
            <div className="font-medium">{m.subject}</div>
            <div className="text-sm">{m.message}</div>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => changeMessageStatus(m.id, 'seen')}>Mark Seen</Button>
              <Button onClick={() => changeMessageStatus(m.id, 'responded')}>Mark Responded</Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
