"use client";
import React, { useState } from 'react';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { submitReport } from '@/firebase/firestore/support';
import { uploadEvidence } from '@/firebase/storage/support';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ReportForm() {
  const db = useFirestore();
  const { user, data: userData } = useUser();
  const firebaseApp = useFirebaseApp();
  const [reportType, setReportType] = useState('safety');
  const [reportedUser, setReportedUser] = useState('');
  const [rideId, setRideId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return toast({ title: 'Not signed in', description: 'Please sign in to submit a report.' });
    setLoading(true);
    try {
      let evidenceUrl: string | null = null;
      if (file) {
        evidenceUrl = await uploadEvidence(firebaseApp, file, 'reports');
      }
      await submitReport(db, {
        reportType,
        submittedBy: { uid: user.uid, name: userData?.fullName || user.displayName || null, email: user.email || null },
        reportedUser: reportedUser ? { uid: reportedUser } : null,
        rideId: rideId || null,
        subject: subject || null,
        description,
        evidenceUrl,
        status: 'pending',
      });
      toast({ title: 'Report submitted', description: 'Thank you — our team will review this report.' });
      setReportedUser(''); setRideId(''); setSubject(''); setDescription(''); setFile(null);
    } catch (err: any) {
      console.error('Report submit failed', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'Failed to submit report.' });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm">Report Type</label>
        <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-card">
          <option value="safety">Safety / Misbehavior</option>
          <option value="fraud">Fraud / Scam</option>
          <option value="technical">Technical Issue</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="text-sm">Reported User ID (optional)</label>
        <Input value={reportedUser} onChange={(e) => setReportedUser(e.target.value)} placeholder="User UID" />
      </div>

      <div>
        <label className="text-sm">Ride ID (optional)</label>
        <Input value={rideId} onChange={(e) => setRideId(e.target.value)} placeholder="Ride ID" />
      </div>

      <div>
        <label className="text-sm">Subject (optional)</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
      </div>

      <div>
        <label className="text-sm">Details</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full p-2 rounded-md bg-card" />
      </div>

      <div>
        <label className="text-sm">Evidence (optional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Report'}</Button>
      </div>
    </form>
  );
}
