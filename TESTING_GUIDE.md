# Testing Guide - Cross-University Security Fix

## Test Environment Setup

### Prerequisites
- Access to FAST and NED authentication portals
- Firebase/Firestore access for manual data verification
- Two browser sessions or incognito windows
- Test email accounts (or use gmail's `+` trick: test+fast@gmail.com)

---

## Test Cases

### TEST 1: Registration Block - Same Email at Different Universities
**Priority**: CRITICAL

**Scenario**: User registers at FAST, then tries to register at NED with same email

**Steps**:
1. Open FAST university register: `/auth/fast/register`
2. Enter email: `test.cross.uni@example.com`
3. Enter password: `Password123!`
4. Click "Register" → Should succeed
5. Complete email verification
6. Open NED register in new browser: `/auth/ned/register`
7. Enter same email: `test.cross.uni@example.com`
8. Enter any password
9. Click "Register"

**Expected Result**:
- ❌ Registration blocked
- Error message displays: "This email is already registered with FAST University. Please use a different email or sign in to your existing account."
- No OTP sent to email
- Firebase user NOT created

**Verification**:
- Check browser console for API call to `/api/check-email-available`
- Verify 409 status code in network tab
- Confirm Firestore shows user only in `universities/fast/users` collection

---

### TEST 2: Login Prevention - Wrong University Portal
**Priority**: CRITICAL

**Scenario**: User registered at NED tries to login at FAST portal

**Steps**:
1. Register new user at NED: `ned.student@example.com` / `TestPass123!`
2. Complete email verification
3. Verify user exists in `universities/ned/users` Firestore
4. Open FAST login portal in new session: `/auth/fast/login`
5. Enter email: `ned.student@example.com`
6. Enter password: `TestPass123!`
7. Click "Sign In"

**Expected Result**:
- ❌ Login fails
- Error message: "This email is registered with NED University. Please sign in to the correct university portal or use a different email."
- Firebase user signed out
- User redirected to login page
- No dashboard access

**Verification**:
- Network tab shows `/api/admin/isMember` returns `{ isMember: true, university: 'ned', registeredIn: 'ned' }`
- User does NOT see dashboard

---

### TEST 3: Valid Registration Flow - Fresh Email
**Priority**: CRITICAL

**Scenario**: New user registers at university with fresh email

**Steps**:
1. Generate unique email: `newuser.` + timestamp + `@example.com`
2. Go to FAST register
3. Enter email and password
4. Click "Register"
5. Enter verification code

**Expected Result**:
- ✅ Registration succeeds
- OTP sent to email (or visible in dev console)
- Email verification page shows
- After OTP verification, redirected to login
- Can login successfully

---

### TEST 4: Admin Cross-University Access
**Priority**: HIGH

**Scenario**: Admin account can access both portals

**Steps**:
1. Ensure your email is in `NEXT_PUBLIC_ADMIN_EMAILS`
2. Set admin flag in `admins/{uid}` Firestore doc
3. Register at FAST with admin email
4. Go to NED login
5. Enter same email and password
6. Click "Sign In"

**Expected Result**:
- ✅ Admin can login (not blocked)
- Redirected to dashboard
- Toast message: "Admin access granted"
- Can access both university portals

**Verification**:
- User has document in both `universities/fast/users` and `universities/ned/users`
- Check Firestore `admins/{uid}` exists

---

### TEST 5: OTP Generation Blocks Conflicting Email
**Priority**: MEDIUM

**Scenario**: System prevents OTP generation if email exists in other university

**Steps**:
1. Manually create user in `universities/ned/users` with email `conflict@test.com`
2. Go to FAST register
3. Enter email: `conflict@test.com`
4. Enter password and submit
5. Monitor API calls

**Expected Result**:
- ❌ Registration blocked before OTP
- Error message about existing email
- Network tab shows `/api/send-signup-otp` returns 409 Conflict
- Firebase user created but NOT verified

---

### TEST 6: Email Verification Blocks Conflicting Email
**Priority**: MEDIUM

**Scenario**: Final check prevents verification if email found in other university

**Steps**:
1. Interrupt normal flow (or manually test)
2. Create `signup_otps/{uid}` with email in one university
3. Add that email to other university after OTP created
4. Call `/api/verify-signup-email` with valid OTP

**Expected Result**:
- ❌ Verification fails with 409 Conflict
- OTP document deleted
- Error message displayed
- Firestore profile NOT created
- Client receives cleanup signal

---

### TEST 7: Firebase User Cleanup on Conflict
**Priority**: MEDIUM

**Scenario**: Orphaned Firebase auth user is deleted on email conflict

**Steps**:
1. Break email verification somehow (e.g., manually add email to other uni)
2. Try to verify email with valid OTP
3. Get 409 Conflict response
4. Monitor client cleanup

**Expected Result**:
- Firebase user deleted (no auth entry remains)
- User redirected to select-university
- Toast message shown: "Email Already Registered"
- Can register again with different email

**Verification**:
- Firebase console shows user no longer exists
- Next registration with same email succeeds

---

### TEST 8: Email Case Insensitivity
**Priority**: LOW

**Scenario**: Email comparison is case-insensitive

**Steps**:
1. Register `TEST@example.com` at FAST
2. Try to register `test@example.com` at NED (different case)

**Expected Result**:
- ❌ Registration blocked
- System recognizes same email despite case difference
- Error message shown

---

### TEST 9: Email Whitespace Handling
**Priority**: LOW

**Scenario**: Emails with leading/trailing spaces are handled

**Steps**:
1. Register `user@example.com` at FAST
2. Try to register ` user@example.com ` at NED (with spaces)

**Expected Result**:
- ❌ Registration blocked
- System trims whitespace before checking
- Same email detected

---

### TEST 10: Existing Multiple-Registration Users
**Priority**: MEDIUM

**Scenario**: Legacy users with multiple registrations are handled

**Steps**:
1. Find user in system with profiles in both universities
2. Try to login to each university
3. Verify behavior

**Expected Behavior**:
- User can login to registered university
- Cannot login to other university
- May need manual cleanup by admin if issues occur

---

## Regression Tests

### Verify Existing Features Still Work

#### TEST R1: Normal Registration and Login
- [ ] User can register with new email at FAST
- [ ] User receives OTP email
- [ ] User can verify email and complete registration
- [ ] User can login and access dashboard

#### TEST R2: Password Reset
- [ ] Forgot password flow works
- [ ] OTP sent correctly
- [ ] Password reset succeeds
- [ ] New password works for login

#### TEST R3: Profile Completion
- [ ] Incomplete profiles require completion
- [ ] User can save profile and proceed
- [ ] Profile data persists correctly

#### TEST R4: Ride Operations
- [ ] Creating rides works
- [ ] Booking rides works
- [ ] Viewing ride history works
- [ ] No interference from security changes

---

## Manual Firestore Inspection

After tests, verify database state:

### Check FAST University Users
```
Collection: universities/fast/users
For registered test user:
  ✓ email field exists
  ✓ emailVerified = true (after verification)
  ✓ university = "fast"
  ✓ createdAt timestamp present
```

### Check NED University Users  
```
Collection: universities/ned/users
For registered test user:
  ✓ email field exists
  ✓ emailVerified = true (after verification)
  ✓ university = "ned"
  ✓ createdAt timestamp present
```

### Verify No Cross-Entries
```
univerities/fast/users - should NOT have NED-registered emails
universities/ned/users - should NOT have FAST-registered emails
```

---

## Performance Testing

### Load Test Considerations
- Email checks add 1-2 Firestore reads
- Monitor Firestore read quota
- No special indexes needed for `email` field queries

### Expected Performance
- Email availability check: <100ms
- OTP generation: <200ms (includes email send)
- Email verification: <150ms

---

## Browser Console Checks

Look for these debug logs:

**Successful Pre-Check**:
```
POST /api/check-email-available 200 OK
Response: { available: true }
```

**Blocked Registration**:
```
POST /api/check-email-available 200 OK
Response: { available: false, existsIn: "ned", ... }
```

**OTP Generation**:
```
POST /api/send-signup-otp 200 OK (if email clear)
POST /api/send-signup-otp 409 Conflict (if email exists elsewhere)
```

**Admin Check During Login**:
```
POST /api/admin/isMember 200 OK
Response: { isMember: true, university: "ned", registeredIn: "ned" }
```

---

## Sign-Off Checklist

- [ ] All CRITICAL tests (1-2) pass
- [ ] All HIGH tests (4) pass
- [ ] All regression tests (R1-4) pass
- [ ] No console errors in browser
- [ ] Firestore data verified
- [ ] Performance acceptable
- [ ] Email functionality tested (if mail enabled)
- [ ] Ready for production deployment

---

## Troubleshooting

### Issue: Email still allows registration at second university
**Solution**: 
- Check `/api/check-email-available` is being called
- Verify Firestore query is finding existing email
- Check network tab for 200 vs 409 status

### Issue: Login allows access at wrong university
**Solution**:
- Verify `/api/admin/isMember` is called during login
- Check response returns correct `registeredIn` field
- Ensure auth-form logic checks `registeredIn` field

### Issue: Firebase user not deleted on conflict
**Solution**:
- Verify verify-email/page.tsx has user delete logic
- Check browser auth state after conflict
- May need to retry verification page

### Issue: Email verification always fails
**Solution**:
- Check OTP hash matches
- Verify `signup_otps` document exists
- Ensure email not added to other university after OTP created
- Check server logs for validation errors
