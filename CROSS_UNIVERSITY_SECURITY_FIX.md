# Cross-University Account Access Security Fix

## Problem Statement
Users registered at FAST University could log into NED University portal (and vice versa) using the same email address without being registered there. This violated data isolation and security requirements where each email should be tied to only ONE university.

## Root Cause
The authentication system was not preventing:
1. **Registration**: A user could create an account at one university with an email that's already registered at another university
2. **Login**: A user could attempt to log in at the wrong university portal and receive an OTP

## Solution Implemented

### 1. **Email Pre-Check Before Registration** (auth-form.tsx)
- Added `/api/check-email-available` endpoint call BEFORE creating Firebase user
- Checks both FAST and NED universities for existing email registrations
- Prevents Firebase account creation if email already exists elsewhere
- Shows clear error message: "This email is already registered with [University]. Please use a different email or sign in to your existing account."

**File**: `src/components/auth/auth-form.tsx`
- New check in `onSubmit()` function for registration action
- Prevents user creation if email conflict detected

### 2. **Email Availability Check API** (NEW)
- Created new endpoint: `/api/check-email-available/route.ts`
- Queries both `universities/fast/users` and `universities/ned/users` collections
- Returns availability status with detailed message
- **Response**:
  - `{ available: true }` - Email can be used
  - `{ available: false, existsIn: "fast", message: "..." }` - Email already registered

**File**: `src/app/api/check-email-available/route.ts`

### 3. **Backend OTP Validation** (send-signup-otp.ts)
- Added email uniqueness check in `/api/send-signup-otp`
- Prevents OTP generation if email exists in OTHER university
- Returns **409 Conflict** status with clear message
- Error: "This email is already registered with [University]"

**File**: `src/app/api/send-signup-otp/route.ts`

### 4. **Email Verification Double-Check** (verify-signup-email.ts)
- Added final validation in `/api/verify-signup-email`
- Checks again if email exists in other university after OTP verification
- Prevents Firestore record creation if conflict found
- Returns **409 Conflict** with explanation

**File**: `src/app/api/verify-signup-email/route.ts`

### 5. **Firebase Account Cleanup** (verify-email/page.tsx)
- When 409 conflict occurs during email verification
- Automatically deletes the Firebase auth user (orphaned account)
- Redirects user back to university selection
- Shows clear error message

**File**: `src/app/auth/verify-email/page.tsx`

### 6. **Enhanced Login Error Messages** (auth-form.tsx + isMember/route.ts)
- Updated isMember API to return which university user is registered with
- When user tries to login at wrong university, shows:
  - "This email is registered with [University]. Please sign in to the correct university portal or use a different email."
- Non-admin users are blocked from cross-university login
- Admin accounts still have cross-portal access for administrative purposes

**Files**:
- `src/components/auth/auth-form.tsx` - Better error messaging
- `src/app/api/admin/isMember/route.ts` - Returns registered university info

## Security Checks Added

| Layer | Check | Response |
|-------|-------|----------|
| **Pre-Registration** | Client calls `/api/check-email-available` | Block if email found in any university |
| **OTP Generation** | Backend checks other university | 409 Conflict if email exists elsewhere |
| **Email Verification** | Backend double-checks other university | 409 Conflict, delete Firebase user if conflict |
| **Login** | Check membership, deny cross-university access | Clear error message with university name |

## Data Flow Protection

### Registration Flow
```
User enters email → Check email availability (all universities)
    ↓ If available: Continue
    ↓ If not: Block with error
Create Firebase user → Generate OTP
    ↓
Verify OTP → Check email not in other university
    ↓ If clear: Mark verified
    ↓ If conflict: Delete Firebase user, show error
Create university-scoped user profile
```

### Login Flow
```
User selects university → Sign in to Firebase
    ↓
Check isMember API → Is user registered at THIS university?
    ↓ Yes: Allow login
    ↓ No, but registered elsewhere: Show which university & block
    ↓ No, not registered anywhere: Show error
```

## Testing Recommendations

1. **Test Registration Block**
   - Register with `user@example.com` at FAST
   - Try to register `user@example.com` at NED
   - Should block with message about FAST registration

2. **Test Login Prevention**
   - Register at NED with `ned_user@example.com`
   - Try to login at FAST with same email
   - Should show: "Email registered with NED University"

3. **Test Admin Override**
   - Admin account in `NEXT_PUBLIC_ADMIN_EMAILS` can still login from both portals

4. **Test Cleanup**
   - Break email verification flow to see Firebase user deletion

## Environment Variables
No new environment variables needed. Uses existing:
- `FIREBASE_EMAIL_USER` - For OTP emails
- `NEXT_PUBLIC_ADMIN_EMAILS` - For admin exception

## Backward Compatibility
- ✅ Existing users unaffected
- ✅ Admin access preserved  
- ✅ Cross-university check only on registration/login, not on active sessions
- ✅ Legacy user format support maintained

## Files Modified

1. `src/app/api/check-email-available/route.ts` - **NEW**
2. `src/app/api/send-signup-otp/route.ts` - Added email check
3. `src/app/api/verify-signup-email/route.ts` - Added email check & conflict handling
4. `src/app/api/admin/isMember/route.ts` - Enhanced response with registered university
5. `src/components/auth/auth-form.tsx` - Added pre-check & better error messages
6. `src/app/auth/verify-email/page.tsx` - Added cleanup on conflict

## Status
✅ **COMPLETE AND READY FOR TESTING**

All critical layers now have email uniqueness enforcement:
- Pre-registration check
- OTP generation validation  
- Email verification validation
- Login prevention with clear messaging
- Automatic cleanup of orphaned accounts
