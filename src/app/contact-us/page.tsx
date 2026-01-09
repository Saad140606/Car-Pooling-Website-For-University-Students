"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ContactUsPage() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.displayName || userData?.fullName || '');
      setEmail(user.email || '');
    }
  }, [user, userData]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const payload: any = { name, email, message };
      if (user) payload.uid = user.uid;

      const res = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast({ title: 'Message sent', description: 'Thanks — we will get back to you shortly.' });
      setMessage('');
    } catch (err: any) {
      console.error('Contact submit failed', err);
      toast({ variant: 'destructive', title: 'Could not send message', description: err?.message || 'Try again later.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-headline mb-4">Contact Us</h1>
      <p className="mb-4 text-sm text-muted-foreground">Send us a message — authenticated users will be contacted faster.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full p-2 rounded-md bg-card text-foreground border border-border"
            required
            minLength={10}
          />
          <p className="text-xs text-muted-foreground mt-1">Minimum 10 characters.</p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send Message'}</Button>
        </div>
      </form>
    </div>
  );
}
