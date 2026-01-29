'use client';

import React, { useState } from 'react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/premium-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, Lock, Trash2, Copy, Loader2, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AccountPage() {
  const router = useRouter();
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isVerified = user?.emailVerified || false;
  const joinDate = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please fill in all fields.' });
      return;
    }

    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Weak password', description: 'Password must be at least 8 characters.' });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Check password change rate limit (3 changes per 2 weeks)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const userRef = doc(firestore!, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const passwordChanges = userData?.passwordChanges || [];
      
      // Filter changes within last 2 weeks
      const recentChanges = passwordChanges.filter((change: any) => {
        const changeDate = change.timestamp?.toDate?.() || new Date(change.timestamp);
        return changeDate >= twoWeeksAgo;
      });
      
      if (recentChanges.length >= 3) {
        toast({ 
          variant: 'destructive', 
          title: 'Password change limit reached', 
          description: 'You can only change your password 3 times within 2 weeks for security reasons. Please try again later.' 
        });
        setLoading(false);
        return;
      }
      
      await updatePassword(user, newPassword);
      
      // Record this password change
      const updatedChanges = [...recentChanges, { timestamp: new Date() }];
      await updateDoc(userRef, { passwordChanges: updatedChanges });
      
      toast({ title: 'Password updated!', description: 'Your password has been changed successfully.' });
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err?.message?.includes('auth/wrong-password')
          ? 'Incorrect current password.'
          : err?.message || 'Could not update password.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firestore) return;

    if (!deletePassword) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please enter your password to confirm.' });
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // Delete user doc
      if (userData?.university) {
        const userRef = doc(firestore, 'universities', userData.university, 'users', user.uid);
        await deleteDoc(userRef);
      }

      // Delete Firebase user
      await user.delete();

      toast({
        title: 'Account deleted',
        description: 'Your account and data have been permanently removed.',
      });

      router.push('/');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion failed',
        description: err?.message || 'Could not delete account.',
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-4 sm:py-6 md:py-8 px-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-slate-400">Manage your account security and preferences</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Account Status */}
        <Card className="border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Email</div>
                <div className="font-semibold text-white mb-2">{user?.email}</div>
                <Badge variant={isVerified ? 'success' : 'warning'} size="sm">
                  {isVerified ? (
                    <><CheckCircle2 className="mr-1 h-3 w-3" />Verified</>
                  ) : (
                    <>Unverified</>
                  )}
                </Badge>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Member Since</div>
                <div className="font-semibold text-white">
                  {joinDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {Math.floor((Date.now() - joinDate!.getTime()) / (1000 * 60 * 60 * 24))} days ago
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-3xl font-bold text-primary">0</div>
                <div className="text-sm text-slate-400 mt-1">Total Rides</div>
              </div>
              <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-3xl font-bold text-green-400">0</div>
                <div className="text-sm text-slate-400 mt-1">Completed</div>
              </div>
              <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-3xl font-bold text-blue-400">5.0</div>
                <div className="text-sm text-slate-400 mt-1">Rating</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white mb-1">Password</div>
                <div className="text-sm text-slate-400">Last changed never</div>
              </div>
              <Button onClick={() => setShowPasswordDialog(true)} variant="outline" size="sm">
                Change Password
              </Button>
            </div>

            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-200">
                For your security, always use a strong, unique password and never share it with anyone.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border border-red-900/50 bg-gradient-to-br from-red-950/30 to-red-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/30 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-200">
                These actions cannot be undone. Please proceed with caution.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="border-slate-700 bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password (min 8 characters)"
                className="border-slate-700 bg-slate-900"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowPasswordDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-red-200">
              This action is permanent. All your data will be deleted.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-300 text-sm">
              You will not be able to recover your account or data after deletion.
            </AlertDescription>
          </Alert>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Confirm with your password
            </label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password to confirm"
              className="border-red-900/50 bg-red-950/20"
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={loading || !deletePassword}
              variant="destructive"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
