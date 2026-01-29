# Technical Implementation Details

## Architecture Overview

```
Registration Attempt
│
├─ PRE-CHECK: /api/check-email-available
│  ├─ Query: universities/fast/users (email == input)
│  ├─ Query: universities/ned/users (email == input)
│  └─ Return: { available: true/false }
│
├─ If available: Create Firebase Auth User
│
├─ OTP PHASE: /api/send-signup-otp  
│  ├─ Check again: other university collection
│  └─ Reject with 409 if found
│
├─ Verification: /api/verify-signup-email
│  ├─ Verify OTP hash
│  ├─ Check email NOT in other university
│  └─ Create university-scoped profile
│
└─ On 409 Conflict: Client deletes Firebase user


Login Attempt
│
├─ Firebase signInWithEmailAndPassword()
│
├─ /api/admin/isMember Check
│  ├─ Is user in selected university? YES → Allow
│  ├─ Is user in OTHER university? YES → Block (409 equivalent)
│  └─ Return: { isMember, university, registeredIn }
│
└─ On wrong university: signOut + show error
```

## API Responses

### 1. check-email-available
```typescript
// Request
POST /api/check-email-available
{ email: "user@example.com", university: "fast" }

// Success Response
{ available: true }

// Conflict Response  
{
  available: false,
  existsIn: "ned",
  message: "This email is already registered with NED University."
}
```

### 2. send-signup-otp
```typescript
// Added Check:
const otherUniversity = university === 'fast' ? 'ned' : 'fast';
const otherUniUsersRef = db.collection('universities').doc(otherUniversity).collection('users');
const existingUserQuery = await otherUniUsersRef.where('email', '==', email).limit(1).get();

if (!existingUserQuery.empty) {
  // Return 409 Conflict
  return NextResponse.json({
    error: `This email is already registered with ${otherUniversity} University...`
  }, { status: 409 });
}
```

### 3. verify-signup-email
```typescript
// Double-check at verification time
const otherUni = otpData.university === 'fast' ? 'ned' : 'fast';
const otherUniUsersRef = db.collection('universities').doc(otherUni).collection('users');
const existingEmailQuery = await otherUniUsersRef.where('email', '==', otpData.email).limit(1).get();

if (!existingEmailQuery.empty) {
  // Delete OTP and reject with 409
  await signupOtpRef.delete();
  return NextResponse.json({
    error: `This email is already registered with ${otherUni} University...`
  }, { status: 409 });
}
```

### 4. admin/isMember
```typescript
// Enhanced response includes registered university
const otherSnap = await admin.firestore().doc(
  `universities/${otherUni}/users/${uid}`
).get();

if (otherSnap && otherSnap.exists) {
  return NextResponse.json({ 
    isMember: true, 
    isAdmin, 
    university: otherUni,
    registeredIn: otherUni  // NEW FIELD
  });
}
```

## Client-Side Changes

### auth-form.tsx - Pre-Registration Check
```typescript
if (action === "register") {
  // NEW: Check email before creating Firebase user
  const emailCheckResponse = await fetch('/api/check-email-available', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: values.email, university })
  });

  const emailCheckData = await emailCheckResponse.json();
  
  if (!emailCheckData.available) {
    toast({
      variant: 'destructive',
      title: 'Email Already Registered',
      description: emailCheckData.message || '...'
    });
    return;
  }
  
  // Only NOW create Firebase user
  const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
}
```

### auth-form.tsx - Enhanced Login Error
```typescript
// Member exists in other university
if (!isAdminAccount) {
  const registeredUni = serverResult.registeredIn || otherUni;
  const uniName = registeredUni === 'fast' ? 'FAST University' : 'NED University';
  
  toast({ 
    variant: 'destructive', 
    title: 'Account Already Exists', 
    description: `This email is registered with ${uniName}. Please sign in to the correct university portal...`
  });
}
```

### verify-email/page.tsx - Cleanup on Conflict
```typescript
// Handle 409 Conflict during email verification
if (response.status === 409) {
  // Delete orphaned Firebase user
  try {
    if (auth?.currentUser) {
      await auth.currentUser.delete();
    }
  } catch (deleteErr) {
    console.warn('Could not delete Firebase user:', deleteErr);
  }
  
  toast({ 
    variant: 'destructive',
    title: 'Email Already Registered',
    description: msg 
  });
  
  setTimeout(() => router.push('/auth/select-university'), 2000);
}
```

## Database Queries Used

### Check Email in Firestore
```typescript
// Query pattern used across multiple endpoints
const usersRef = db.collection('universities').doc(university).collection('users');
const query = await usersRef.where('email', '==', emailToCheck).limit(1).get();

if (!query.empty) {
  // Email exists
}
```

**Indexes Required**: 
- Collection: `universities/{uni}/users`
- Field: `email` (ascending)
- Composite index not needed (single field)

## Security Considerations

1. **Email Normalization**: All checks use lowercase and trimmed emails
2. **Race Condition Prevention**: OTP-based approach ensures atomicity
3. **Admin Override**: Allowed via NEXT_PUBLIC_ADMIN_EMAILS
4. **Cleanup**: Orphaned Firebase users auto-deleted on conflicts
5. **Error Messages**: Informative but not exposing system details

## Backward Compatibility

- Existing users with multiple university registrations:
  - Will need to use correct university portal going forward
  - Can contact support to reclaim email if needed
  - Admin can create new profile under correct university if needed

- Legacy user document format still supported:
  - `users/{university}_{uid}` still recognized
  - New format preferred: `universities/{university}/users/{uid}`

## Performance Impact

- **Pre-check**: Single Firestore query (minimal impact)
- **OTP Generation**: Already had Firestore access, adds 1 query
- **Verification**: Already had Firestore access, adds 1 query
- **Login**: Uses existing isMember endpoint

**Database Load**: Minimal (adds ~2-3 Firestore queries per registration)

## Deployment Notes

1. No database migration needed
2. No schema changes required
3. Can be deployed to staging immediately
4. Test thoroughly before production
5. No API versioning needed

## Rollback Plan

If issues found:
1. Revert modified files to previous version
2. Email checks will be disabled
3. System returns to previous behavior
4. No cleanup needed
