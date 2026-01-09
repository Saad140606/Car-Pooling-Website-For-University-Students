"use client";
import React, { useState } from 'react';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { submitContactMessage } from '@/firebase/firestore/support';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ContactForm() {
  const db = useFirestore();
  const { user, data: userData } = useUser();
  const firebaseApp = useFirebaseApp();
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return toast({ title: 'Not signed in', description: 'Please sign in to submit a message.' });
    setLoading(true);
    try {
      await submitContactMessage(db, {
        category,
        subject,
        message,
        uid: user.uid,
        name: userData?.fullName || user.displayName || null,
        email: user.email || null,
      });
      toast({ title: 'Message sent', description: 'Thank you — we will review your message.' });
      setSubject(''); setMessage('');
    } catch (err: any) {
      console.error('Contact submit failed', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'Failed to submit message.' });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-card">
          <option value="general">General</option>
          <option value="feedback">Feedback</option>
          <option value="bug">Bug Report</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="text-sm">Subject</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
      </div>
      <div>
        <label className="text-sm">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full p-2 rounded-md bg-card text-foreground border border-border"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Message'}</Button>
      </div>
    </form>
  );
}
