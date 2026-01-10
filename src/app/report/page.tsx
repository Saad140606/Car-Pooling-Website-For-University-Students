"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { useUser, useFirestore } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function ReportPage() {
  const { user, initialized } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [role, setRole] = useState<'driver'|'passenger'>('passenger');
  const [againstUserUid, setAgainstUserUid] = useState('');
  const [rideId, setRideId] = useState('');
  const [category, setCategory] = useState<'misbehavior'|'safety'|'fraud'|'app_issue'>('misbehavior');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Wait for auth initialization to avoid redirecting during transient null states
    if (initialized && user === null) {
      router.push('/auth/select-university');
    }
  }, [user, initialized, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (description.trim().length < 10) {
      toast({ variant: 'destructive', title: 'Too short', description: 'Please provide at least 10 characters.' });
      return;
    }
    setSending(true);
    try {
      const doc = {
        reportedBy: { uid: user.uid, role },
        againstUserUid: againstUserUid || null,
        rideId: rideId || null,
        category,
        description: description.trim(),
        createdAt: serverTimestamp(),
        status: 'pending' as const,
      };
      await addDoc(safeCollection(firestore!, 'reports'), doc);
      toast({ title: 'Report submitted', description: 'Thank you. Our admin team will review this.' });
      // Redirect to dashboard root (no dedicated /dashboard/support route exists)
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Report submit failed', err);
      toast({ variant: 'destructive', title: 'Could not submit report', description: err?.message || 'Try again later.' });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-headline mb-4">Report an Issue</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">You are reporting as</label>
          <Select value={role} onValueChange={(v: any) => setRole(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="passenger">Passenger</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Against User (UID) — optional</label>
          <Input value={againstUserUid} onChange={(e) => setAgainstUserUid(e.target.value)} placeholder="UID of the user you are reporting" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ride ID — optional</label>
          <Input value={rideId} onChange={(e) => setRideId(e.target.value)} placeholder="Ride document ID (if applicable)" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <Select value={category} onValueChange={(v: any) => setCategory(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="misbehavior">Misbehavior</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="fraud">Fraud</SelectItem>
              <SelectItem value="app_issue">App Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 rounded-md bg-card text-foreground border border-border"
            required
            minLength={10}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Submit Report'}</Button>
        </div>
      </form>
    </div>
  );
}
