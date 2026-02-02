# Email Verification Security - Testing Guide

## 🔴 CRITICAL TEST: Unverified User Sign-In Attempt

### Test Steps:
1. **Sign up a new account**
   - Go to `/auth/ned/register` or `/auth/fast/register`
   - Enter email: `test@example.com`
   - Enter password: `Test123!`
   - Click "Create Account"
   
2. **Receive OTP but DON'T verify**
   - You'll see the verification page with OTP input
   - **DO NOT enter the OTP**
   - Check browser console for dev OTP (if in dev mode)
   - Use browser back button or navigate to `/auth/ned/login`

3. **Try to sign in WITHOUT verifying**
   - Enter the same email: `test@example.com`
   - Enter the same password: `Test123!`
   - Click "Sign In"

### ✅ Expected Result (CRITICAL):
```
❌ User CANNOT sign in
✅ User is signed out immediately
✅ Toast shows: "Email Verification Required"
✅ New OTP is sent to email
✅ User is redirected to /auth/verify-email page
✅ Dashboard access is BLOCKED
```

### ❌ Failure (Would indicate security flaw):
```
User successfully signs in
User reaches dashboard
No verification prompt shown
```

---

## Test 2: Normal Verified User Flow

### Test Steps:
1. Sign up with email
2. Enter the OTP code
3. Verify email successfully
4. Sign in with email/password

### ✅ Expected Result:
```
✅ User can sign in
✅ Dashboard loads successfully
✅ No verification prompts
✅ Full access to all features
```

---

## Test 3: Direct Dashboard Access (Unverified)

### Test Steps:
1. Sign up but don't verify
2. Manually type URL: `http://localhost:3000/dashboard/rides`
3. Press Enter

### ✅ Expected Result:
```
✅ Dashboard layout verification check runs
✅ User is signed out
✅ Redirected to verification page
✅ Toast shows: "Email Verification Required"
✅ Access BLOCKED
```

---

## Test 4: Admin Bypass

### Test Steps:
1. Sign in with admin email (from NEXT_PUBLIC_ADMIN_EMAILS)
2. Admin doesn't need verification

### ✅ Expected Result:
```
✅ Admin can sign in immediately
✅ No verification required
✅ Full dashboard access
```

---

## Test 5: React Key Warning Check

### Test Steps:
1. Sign in to dashboard
2. Open browser DevTools Console (F12)
3. Navigate to different dashboard pages
4. Check for console warnings

### ✅ Expected Result:
```
✅ No "Each child in a list should have a unique key" warning
✅ Console is clean
```

---

## Browser Console Logs to Monitor

### Successful Verification Block:
```
[AUTH] Blocked unverified user login attempt: test@example.com
```

### Dashboard Protection:
```
[Dashboard] Unverified user detected, redirecting to verification
```

### Verification Check Pass:
```
(No special log - silent success)
```

---

## Quick Test Checklist

- [ ] Sign up new account
- [ ] Skip OTP verification
- [ ] Try to sign in → Should be BLOCKED ✅
- [ ] Verify with OTP
- [ ] Sign in again → Should work ✅
- [ ] Check console for key warnings → Should be clean ✅
- [ ] Try direct dashboard URL (unverified) → Should be BLOCKED ✅
- [ ] Test admin bypass → Should work ✅

---

## Dev Mode Notes

When running in development, you'll see OTP codes in:
1. Browser console: `Dev Mode - OTP: 123456`
2. Toast notification: `Dev: OTP 123456`
3. Firestore: Check `otpCodes/{uid}` document

---

## Production Behavior

In production:
- No OTP shown in console
- No dev toasts
- OTP only sent to email
- All verification checks still enforced

---

## What to Look For

### 🔴 RED FLAGS (Security Issues):
- Unverified user reaches dashboard
- Sign-in succeeds without verification
- Verification can be bypassed

### ✅ GREEN FLAGS (Working Correctly):
- Unverified user is signed out
- Verification page shown
- Dashboard blocked
- Clear error messages
- New OTP sent automatically

---

## Files to Monitor

1. **Console Logs**: Check for `[AUTH]` and `[Dashboard]` prefixes
2. **Network Tab**: Watch for `/api/send-signup-otp` calls
3. **Application Tab**: Check localStorage/sessionStorage
4. **Firestore**: Check `emailVerified` field

---

## Emergency Rollback

If issues occur:
1. Revert changes to:
   - `src/components/auth/auth-form.tsx` (lines 257-305)
   - `src/app/dashboard/layout.tsx` (lines 40-100)
2. Delete `src/lib/emailVerification.ts`
3. Test original behavior

---

## Success Criteria

✅ All 5 tests pass
✅ No console errors
✅ No React key warnings
✅ Unverified users CANNOT access dashboard
✅ Verified users can access normally
✅ Admin bypass works
✅ Clear user feedback

---

**Test Status**: Ready for testing
**Priority**: 🔴 CRITICAL - Test immediately before deployment
