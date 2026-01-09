"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getUniversityShortLabel } from '@/lib/universities';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export default function CompleteProfilePage() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | undefined>(undefined);
  const [university, setUniversity] = useState<"ned" | "fast" | undefined>(undefined);
  const [contactNumber, setContactNumber] = useState("");
  const [transport, setTransport] = useState<"car" | "bike" | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If profile is complete, go to dashboard. Otherwise pre-fill any values we have.
    if (userData) {
      const complete = userData.fullName && userData.gender && userData.university && userData.contactNumber && userData.transport;
      if (complete) {
        router.replace('/dashboard/rides');
        return;
      }
      // prefill fields from existing profile (if any)
      if (userData.fullName) setFullName(userData.fullName);
      if (userData.gender) setGender((userData.gender as any) || undefined);
      if (userData.university) setUniversity((userData.university as any) || undefined);
      if (userData.contactNumber) setContactNumber(userData.contactNumber);
      if (userData.transport) setTransport((userData.transport as any) || undefined);
    }

    // try to infer university from email when not set (used as authoritative if user didn't register with a university field)
    if (user && user.email && !university) {
      if (user.email.endsWith('@nu.edu.pk')) setUniversity('fast');
      if (user.email.endsWith('@neduet.edu.pk')) setUniversity('ned');
    }
    if (user && user.displayName && !fullName) {
      setFullName(user.displayName);
    }
  }, [user, userData, router, university, fullName]);

  // Derived/authoritative university value:
  const derivedUniversity = userData?.university || university;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!fullName || !gender || !contactNumber || !transport) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill all fields.' });
      return;
    }

    // Ensure we have a university value (either existing or inferred / selected)
    const finalUniversity = derivedUniversity || university;
    if (!finalUniversity) {
      toast({ variant: 'destructive', title: 'Missing university', description: 'Could not determine your university. Please select it or contact support.' });
      return;
    }

    // Normalize and validate Pakistan mobile number (accepts +92 3XXXXXXXXX, 03XXXXXXXXX or 3XXXXXXXXX)
    const normalized = contactNumber.replace(/\s|-/g, '');
    const pakPhoneRegex = /^(?:\+92|0)?3\d{9}$/; // +923xxxxxxxxx or 03xxxxxxxxx or 3xxxxxxxxx
    if (!pakPhoneRegex.test(normalized)) {
      toast({ variant: 'destructive', title: 'Invalid contact', description: 'Please enter a valid Pakistani mobile number (e.g. 03XXXXXXXXX).' });
      return;
    }

    setSaving(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        fullName,
        gender,
        university: finalUniversity,
        contactNumber: normalized,
        transport,
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: 'Profile updated', description: 'Your profile is now complete.' });
      router.push('/dashboard/rides');
    } catch (e: any) {
      console.error('Error saving profile:', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not save profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-headline mb-4">Complete Your Profile</h1>
      <p className="mb-4 text-sm text-muted-foreground">We need a few details to finish setting up your account so you can create rides.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <Select value={gender} onValueChange={(v: any) => setGender(v as any)} disabled={Boolean(userData?.gender)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            {userData?.gender ? (
              <p className="text-xs text-muted-foreground mt-1">Your gender is locked. Choose correctly — it cannot be changed later.</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Please choose your gender carefully; it will be used to enforce gender-specific rides and cannot be changed later.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Transport</label>
            <Select value={transport} onValueChange={(v: any) => setTransport(v as any)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select Transport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="bike">Bike</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contact Number</label>
          <Input placeholder="03XXXXXXXXX" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">Enter a valid Pakistani mobile number (e.g. 03XXXXXXXXX)</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">University</label>
          {derivedUniversity ? (
            <Input value={getUniversityShortLabel(derivedUniversity)} disabled />
          ) : (
            <Select value={university} onValueChange={(v: any) => setUniversity(v as any)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select University (could not infer)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ned">NED University</SelectItem>
                <SelectItem value="fast">FAST University</SelectItem>
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground mt-1">Your university is set automatically based on where you registered (if available) and cannot be changed here unless it cannot be inferred.</p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard/rides')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
