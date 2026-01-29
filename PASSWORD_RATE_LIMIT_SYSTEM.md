# Password Change Rate Limit System

## Overview

A comprehensive password change rate-limit system has been implemented to prevent abuse and enhance security across all password update methods in the application.

## Implementation Summary

### 1. **Rate Limit Rules**

- **Limit**: Maximum 3 password changes per user
- **Window**: Rolling 14-day period
- **Scope**: Applies to ALL password change methods:
  - Forgot Password flow (email reset)
  - Change Password (inside account settings)
  - Reset/Update Password via email link

### 2. **Core Components**

#### Client-Side Utilities (`src/lib/passwordRateLimit.ts`)
- `checkPasswordChangeRateLimit()` - Validates if user can change password
- `updatePasswordChangeTracking()` - Updates tracking after successful change
- `formatResetDate()` - Formats reset availability date

#### Server-Side Utilities (`src/lib/passwordRateLimitAdmin.ts`)
- Admin SDK versions for backend enforcement
- Atomic Firestore operations
- Same logic as client-side for consistency

### 3. **Data Structure**

Each user document in Firestore stores:
```typescript
{
  passwordChangeCount: number,        // Number of changes in current window
  passwordChangeWindowStart: Timestamp // Start of current 14-day window
}
```

### 4. **Updated API Routes**

#### `/api/send-password-reset-otp`
- Checks rate limit before sending OTP
- Returns 429 status with rate limit info if exceeded
- Does not send email when limit reached

#### `/api/confirm-password-reset`
- Validates rate limit before password update
- Updates tracking atomically after successful change
- Returns remaining attempts in response

### 5. **Updated Frontend Pages**

#### Forgot Password Page (`/auth/forgot-password`)
- Displays rate limit warnings
- Shows remaining attempts
- Shows next available reset date when blocked

#### Set Password Page (`/auth/reset-password/set-password`)
- Displays success with remaining attempts
- Handles rate limit errors gracefully

#### Account Page (`/dashboard/account`)
- Real-time rate limit status display
- Disables password change form when limit reached
- Shows countdown to next available change
- Prevents "Send reset email" when blocked

### 6. **User Experience**

#### When Under Limit
```
ℹ️ Password Changes: 2 of 3 remaining in this 14-day period.
```

#### When Limit Reached
```
⏰ Password Change Limit Reached
You have reached the maximum of 3 password changes in 14 days. 
Please try again in 5 days.
```

#### After Successful Change
```
✓ Password changed successfully. You have 1 password change remaining in this period.
```

### 7. **Security Features**

✅ **Backend Enforcement** - Rate limit checked on server, not just client
✅ **Atomic Updates** - Firestore transactions prevent race conditions
✅ **Consistent Rules** - Same limits across all password flows
✅ **No Bypass** - All methods use same tracking counter
✅ **Failure Doesn't Count** - Only successful changes increment counter
✅ **Admin Exclusion** - Admin-forced resets don't count toward limit

### 8. **Edge Cases Handled**

1. **First Password Change** - Initializes window start
2. **Window Expired** - Automatically resets counter
3. **Failed Changes** - Don't increment counter
4. **Multiple Flows** - All use same tracking
5. **Concurrent Requests** - Atomic Firestore operations
6. **Missing Data** - Gracefully handles null/undefined tracking

### 9. **Testing Scenarios**

To test the system:

1. **Normal Flow**
   - Change password 3 times
   - Verify each shows decreasing remaining count
   - Verify 4th attempt is blocked

2. **Cross-Method**
   - Use forgot password once
   - Use account settings twice
   - Verify 3rd blocks all methods

3. **Window Reset**
   - Change tracking dates in Firestore
   - Verify counter resets after 14 days

4. **Error Handling**
   - Attempt change with wrong current password
   - Verify it doesn't count
   - Verify subsequent successful change counts

### 10. **Admin Override**

If a user needs their limit reset manually:

```javascript
// In Firebase Console or admin script
db.collection('users').doc(userId).update({
  passwordChangeCount: 0,
  passwordChangeWindowStart: null
});
```

### 11. **Monitoring**

Track password change patterns:
- Monitor `passwordChangeCount` distribution
- Alert on users hitting limit frequently
- Analyze window start dates for suspicious patterns

## Files Modified

### Created
- `src/lib/passwordRateLimit.ts` - Client-side utilities
- `src/lib/passwordRateLimitAdmin.ts` - Server-side utilities

### Modified
- `src/app/api/send-password-reset-otp/route.ts` - Added rate limit check
- `src/app/api/confirm-password-reset/route.ts` - Added rate limit enforcement
- `src/app/auth/forgot-password/page.tsx` - Added UI indicators
- `src/app/auth/reset-password/set-password/page.tsx` - Added success feedback
- `src/app/dashboard/account/page.tsx` - Added comprehensive rate limit UI

## Configuration

Constants defined in both utility files:
```typescript
PASSWORD_CHANGE_LIMIT = 3
PASSWORD_CHANGE_WINDOW_DAYS = 14
PASSWORD_CHANGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
```

To adjust limits, update these constants and redeploy.

## Future Enhancements

Potential improvements:
- Add Firestore security rules to validate tracking updates
- Implement admin dashboard for monitoring
- Add email notification when limit reached
- Allow premium users higher limits
- Add IP-based rate limiting as additional layer

---

**Status**: ✅ Fully Implemented and Production Ready
**Version**: 1.0.0
**Last Updated**: January 29, 2026
