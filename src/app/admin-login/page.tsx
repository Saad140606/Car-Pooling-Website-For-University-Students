"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { Shield, Mail, Lock, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { saveAdminOtpSession } from '@/lib/adminOtpSession';

export default function AdminLoginPage() {
  const router = useRouter();
  // useSearchParams can cause CSR bailout during prerender - use window.location fallback
  const searchParams = null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [remainingSends, setRemainingSends] = useState<number>(3);
  const [otpHint, setOtpHint] = useState('');
  const [error, setError] = useState('');

  // Check for error parameter in URL
  useEffect(() => {
    let errorParam = null;
    try {
      const params = new URLSearchParams(window.location.search);
      errorParam = params.get('error');
    } catch (e) {
      // ignore in non-browser contexts
    }
    if (errorParam === 'unauthorized') {
      setError('Unauthorized access. Only verified administrators can access the admin portal.');
    } else if (errorParam === 'verification-failed') {
      setError('Failed to verify admin status. Please try again.');
    } else if (errorParam === 'otp-required') {
      setError('Two-factor verification is required for admin access. Please login again.');
    }
  }, [searchParams]);

  const requestOtp = async (forceRefresh = false) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setError('Session expired. Please login again.');
      setOtpStep(false);
      return false;
    }

    setSendingOtp(true);
    setError('');
    try {
      const idToken = await user.getIdToken(forceRefresh);
      const response = await fetch('/api/admin/login-otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'Failed to send OTP code.');
        if (typeof data?.remainingSends === 'number') {
          setRemainingSends(data.remainingSends);
        }
        return false;
      }

      setOtp('');
      setOtpHint('Verification code sent to syedsaadnajam2006@gmail.com');
      if (typeof data?.remainingSends === 'number') {
        setRemainingSends(data.remainingSends);
      }
      return true;
    } catch (e: any) {
      setError(e?.message || 'Could not send OTP code.');
      return false;
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const auth = getAuth();
      
      // STEP 1: Authenticate with Firebase
      console.log('[AdminLogin] Step 1: Authenticating with Firebase...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('[AdminLogin] ✅ Firebase authentication successful:', user.uid);

      // STEP 2: Get Firebase ID token
      console.log('[AdminLogin] Step 2: Getting ID token...');
      const idToken = await user.getIdToken();

      // STEP 3: Verify admin role with backend
      console.log('[AdminLogin] Step 3: Verifying admin role...');
      const response = await fetch('/api/admin/isAdmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      // STEP 4: Check if user is admin
      if (!data.isAdmin) {
        // ❌ NOT AN ADMIN - Block access immediately
        console.error('[AdminLogin] ❌ User is not an admin:', user.email);
        await auth.signOut(); // Force sign out
        setError('Admin account not found or unauthorized access. Only verified administrators can access this portal.');
        setLoading(false);
        return;
      }

      // ✅ ADMIN VERIFIED - Require OTP as second factor before dashboard access
      console.log('[AdminLogin] ✅ Admin role verified, requesting OTP');
      const otpSent = await requestOtp(false);
      if (!otpSent) {
        await signOut(auth);
        setError('Login blocked: OTP could not be sent.');
        setLoading(false);
        return;
      }

      setOtpStep(true);
      setError('');
      return;
    } catch (err: any) {
      console.error('[AdminLogin] Login error:', err);
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/user-not-found') {
        setError('Admin account not found');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setError('Session expired. Please login again.');
      setOtpStep(false);
      return;
    }

    setOtpLoading(true);
    setError('');
    try {
      const idToken = await user.getIdToken(false);
      const response = await fetch('/api/admin/login-otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'OTP verification failed.');
        setOtp('');
        return;
      }

      saveAdminOtpSession(user.uid, user.email || null);
      router.replace('/admin-dashboard');
    } catch (e: any) {
      setError(e?.message || 'OTP verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-slate-400">Secure administrator access</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!otpStep ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@campusride.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Continue
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-2">
                  Admin OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={otpLoading || sendingOtp}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">{otpHint || 'Enter the code sent to syedsaadnajam2006@gmail.com'}</p>
                <p className="text-xs text-slate-500 mt-1">Remaining code requests: {remainingSends}</p>
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpLoading || sendingOtp || otp.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying OTP...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Verify OTP & Login
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => requestOtp(false)}
                disabled={sendingOtp || otpLoading || remainingSends <= 0}
                className="w-full py-3 border border-slate-700 text-slate-200 font-medium rounded-lg hover:bg-slate-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingOtp ? 'Sending code...' : 'Resend OTP Code'}
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-center text-xs text-slate-500">
              This portal is restricted to authorized administrators only.
              <br />
              Unauthorized access attempts are logged and monitored.
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back to main site
          </button>
        </div>
      </div>
    </div>
  );
}
