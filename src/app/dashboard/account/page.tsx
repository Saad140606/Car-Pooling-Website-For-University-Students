"use client";

import { useEffect, useState } from "react";
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { getUniversityShortLabel } from '@/lib/universities';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail } from 'firebase/auth';

export default function AccountPage() {
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | undefined>(undefined);
  const [contactNumber, setContactNumber] = useState('');
  const [transport, setTransport] = useState<'car' | 'bike' | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (userData) {
      setFullName(userData.fullName || '');
      setGender((userData.gender as any) || undefined);
      setContactNumber(userData.contactNumber || '');
      setTransport((userData.transport as any) || undefined);
    }
    if (user && user.displayName && !userData?.fullName) {
      setFullName(user.displayName);
    }
  }, [userData, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!fullName || !gender || !contactNumber || !transport) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill all fields.' });
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
        contactNumber: contactNumber.replace(/\s|-/g, ''),
        transport,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Also update auth profile displayName for convenience
      if (auth && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: fullName });
      }

      toast({ title: 'Profile updated', description: 'Your account information was updated.' });
    } catch (e: any) {
      console.error('Failed to update profile:', e);
      toast({ variant: 'destructive', title: 'Error', description: e?.message || 'Could not update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !auth.currentUser || !auth.currentUser.email) return;
    if (!currentPassword || !newPassword) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter current and new password.' });
      return;
    }

    // Prevent using the same password again
    if (currentPassword.trim() === newPassword.trim()) {
      toast({ variant: 'destructive', title: 'New password matches current', description: 'Your new password must be different from the current password.' });
      return;
    }

    // Ensure the account supports email/password authentication
    const providers = auth.currentUser.providerData || [];
    const hasPasswordProvider = providers.some((p) => p.providerId === 'password');
    if (!hasPasswordProvider) {
      toast({ variant: 'destructive', title: 'Password not set', description: 'Your account was created using a social login and does not have a password. Use "Forgot Password" to create one for your email.' });
      return;
    }

    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);

      // Reauthenticate first and give a clear message if the current password is incorrect
      try {
        await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (reauthErr: any) {
        // Avoid noisy console error output for expected user errors (wrong password/invalid credential).
        if (reauthErr?.code === 'auth/wrong-password' || reauthErr?.code === 'auth/invalid-credential') {
          console.debug('Reauthentication failed: invalid credentials');
          toast({ variant: 'destructive', title: 'Incorrect current password', description: 'The current password you entered is incorrect. Use "Forgot Password" to reset it.' });
        } else if (reauthErr?.code === 'auth/too-many-requests') {
          console.debug('Reauthentication failed: too many attempts', reauthErr);
          toast({ variant: 'destructive', title: 'Too many attempts', description: 'Too many failed attempts. Try again later or use "Forgot Password".' });
        } else {
          console.error('Reauthentication failed:', reauthErr);
          toast({ variant: 'destructive', title: 'Re-authentication failed', description: reauthErr?.message || 'Please try again.' });
        }
        return;
      }

      // If reauthentication succeeded, proceed to update the password and handle errors separately
      try {
        await updatePassword(auth.currentUser, newPassword);
        toast({ title: 'Password changed', description: 'Your password was updated successfully.' });
        setShowPwForm(false);
        setCurrentPassword('');
        setNewPassword('');
      } catch (updateErr: any) {
        if (updateErr?.code === 'auth/requires-recent-login') {
          console.debug('Update password failed: requires recent login', updateErr);
          toast({ variant: 'destructive', title: 'Re-authentication required', description: 'Please sign out and sign in again, then retry changing your password.' });
        } else {
          console.error('Update password failed:', updateErr);
          toast({ variant: 'destructive', title: 'Could not change password', description: updateErr?.message || 'Please try again.' });
        }
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No email available for your account.' });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email!);
      toast({ title: 'Reset email sent', description: 'Check your email to reset your password.' });
      setShowPwForm(false);
    } catch (e: any) {
      console.error('Send reset email failed:', e);
      if (e?.code === 'auth/invalid-email' || e?.code === 'auth/user-not-found') {
        toast({ variant: 'destructive', title: 'Could not send reset email', description: 'No account found for this email. Try signing out and signing in with the correct account.' });
      } else {
        toast({ variant: 'destructive', title: 'Could not send reset email', description: e?.message || 'Please try again.' });
      }
    } finally {
      setResetLoading(false);
    }
  }; 

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input value={user?.email ?? ''} disabled />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">University</label>
              <Input value={userData?.university ? getUniversityShortLabel(userData?.university) : (userData?.university || 'Unknown')} disabled />
              <p className="text-xs text-muted-foreground mt-1">Your university is set when you registered via the Select University page and cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <Select value={gender} onValueChange={(v) => setGender(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Transport</label>
                <Select value={transport} onValueChange={(v) => setTransport(v as any)}>
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
              <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              <Button variant="ghost" onClick={() => {
                setFullName(userData?.fullName || '');
                setGender(userData?.gender || undefined);
                setContactNumber(userData?.contactNumber || '');
                setTransport(userData?.transport || undefined);
              }}>Reset</Button>
              <Button variant="outline" onClick={() => setShowPwForm(s => !s)}>Change Password</Button>
            </div>
          </form>

          {showPwForm && (
            <div className="mt-6">
              <h3 className="font-medium">Change Password</h3>
              <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  {currentPassword && newPassword && currentPassword === newPassword && (
                    <p className="text-xs text-destructive mt-1">New password must be different from your current password.</p>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Button type="submit" disabled={pwLoading || (currentPassword.trim() !== '' && newPassword.trim() !== '' && currentPassword === newPassword)}>{pwLoading ? 'Updating...' : 'Update Password'}</Button>
                  <Button variant="ghost" onClick={() => setShowPwForm(false)}>Cancel</Button>
                  <Button variant="outline" onClick={handleSendResetEmail} disabled={resetLoading || !auth?.currentUser?.email}>
                    {resetLoading ? 'Sending...' : 'Send reset email'}
                  </Button>
                </div>
              </form>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
