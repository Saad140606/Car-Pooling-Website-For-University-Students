# Visual Flow Diagrams - Cross-University Security Fix

## 🔐 Registration Flow - WITH FIX

```
┌─────────────────────────┐
│   User Visits FAST      │
│   Register Page         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  User Enters Email: student@example.com         │
│  User Enters Password                           │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  ⚡ NEW CHECK: Pre-Registration Email Validation │
│  API: /api/check-email-available                │
│                                                 │
│  Query: universities/fast/users                 │
│  Query: universities/ned/users                  │
└──────────┬──────────────────────────────────────┘
           │
           ├─── Email Found in NED? ──┐
           │                           │
           │ NO ▼                      │ YES ▼
           │                        ┌────────────────┐
           │                        │  ERROR 409     │
           │                        │  "Already at   │
           │                        │   NED Uni"     │
           │                        └────────────────┘
           │                        │
           ▼                        ▼
┌─────────────────────────┐   BLOCK REGISTRATION
│ Create Firebase User    │
│ uid: xyz123             │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  ⚡ 2nd CHECK: OTP Generation                    │
│  API: /api/send-signup-otp                      │
│                                                 │
│  Verify email not in OTHER university           │
│  Generate 6-digit OTP                           │
│  Store in signup_otps collection                │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Send OTP via Email          │
│  Redirect to Verify Page     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│  User Enters 6-Digit Code                    │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  ⚡ 3rd CHECK: Email Verification                 │
│  API: /api/verify-signup-email                   │
│                                                  │
│  1. Verify OTP hash matches                      │
│  2. Check email NOT in other university          │
│  3. Create profile in universities/fast/users    │
└──────────┬───────────────────────────────────────┘
           │
           ├─── Email Conflict Detected? ──┐
           │                                │
           │ NO ▼                           │ YES ▼
           │                            ┌─────────────────┐
           │                            │  ERROR 409      │
           │                            │  Delete Firebase│
           │                            │  "Email in other│
           │                            │   university"   │
           │                            └─────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────────────┐   CLEANUP & BLOCK
│ SUCCESS ✅                    │   Registration Failed
│ Profile Created               │
│ Email Verified                │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Redirect to Login             │
│ User can now Sign In          │
└──────────────────────────────┘
```

---

## 🔐 Login Flow - WITH FIX

```
┌─────────────────────────┐
│  User Selects FAST      │
│  Login Portal           │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  User Enters Email: student@example.com     │
│  User Enters Password                       │
└──────────┬──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Firebase signInWithEmailAndPassword()      │
│  (System level, always succeeds if creds OK)│
└──────────┬──────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────────────┐
│  ⚡ CRITICAL CHECK: University Membership      │
│  API: /api/admin/isMember                     │
│                                               │
│  Check: universities/fast/users/{uid}         │
│  Check: universities/ned/users/{uid}          │
└──────────┬────────────────────────────────────┘
           │
           ├─────────────────┬──────────────┬─────────────┐
           │                 │              │             │
       Found     Found      Found in        None
       in FAST   in NED      LEGACY      registered
           │         │           │           │
           ▼         ▼           ▼           ▼
         ✅        ❌          ✅           ❌
      ALLOW     BLOCK      ALLOW       BLOCK
        LOGIN   LOGIN      LOGIN       LOGIN
           │         │           │           │
           │         ├─────┐     │           │
           │         │     │     │           │
           ▼         ▼     ▼     ▼           ▼
        GET        SHOW ERROR   CREATE    SHOW
       PROFILE     "Email at    PROFILE   ERROR
                   NED Uni"               "Not
       Check     (Show which      │      Register
       Complete   uni they're   ✅       ed"
       Profile    registered)    │
           │         │           │           │
        ✅/❌       SIGNOUT      ✅         ✅
           │         │         SIGNOUT      │
           │         │           │           │
           ▼         ▼           ▼           ▼
        ✅         ❌            ✅          ❌
      ALLOW      BLOCK        ALLOW       BLOCK
      LOGIN      REDIRECT     REDIRECT    REDIRECT
        │           │            │          │
        ▼           ▼            ▼          ▼
    DASHBOARD   SELECT-UNI   LOGIN     SELECT-UNI
                PAGE        PAGE       PAGE

Legend:
✅ = Allowed Path
❌ = Blocked Path
⚡ = Security Check
```

---

## 📊 Database State After Operations

### BEFORE FIX (Security Hole)
```
Firebase Auth
├── user1@example.com (uid: abc123)
│   └── password_hash: xxx

Firestore
├── universities/fast/users/abc123
│   ├── email: user1@example.com
│   ├── university: fast
│   └── emailVerified: true
│
├── universities/ned/users/abc123      ⚠️ SAME FIREBASE USER!
│   ├── email: user1@example.com       ⚠️ SAME EMAIL!
│   ├── university: ned                ⚠️ DIFFERENT UNI!
│   └── emailVerified: true

PROBLEM: Same Firebase user in BOTH universities
         Can access either portal with same creds
```

### AFTER FIX (Secure)
```
Firebase Auth
├── user1@example.com (uid: abc123)
│   └── password_hash: xxx

Firestore
├── universities/fast/users/abc123
│   ├── email: user1@example.com
│   ├── university: fast
│   └── emailVerified: true
│
├── universities/ned/users/      ✅ EMPTY - email not repeated!
│   └── (no user1@example.com entry)

✅ SECURE: Firebase user only in ONE university
           Can only access correct portal
```

---

## 🔄 Error Path Example

### Scenario: User tries to register with existing email

```
┌─────────────────────────────┐
│ FAST Register Page          │
│ Email: student@ned.edu.pk   │ (already at NED)
└────────┬────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │ Check Email Available         │
    │ /api/check-email-available   │
    └───────┬──────────────────────┘
            │
            ▼
    ┌──────────────────────────────┐
    │ Query universities/ned/users  │
    │ Find student@ned.edu.pk       │
    │ = FOUND! ❌                    │
    └───────┬──────────────────────┘
            │
            ▼
    ┌──────────────────────────────────────┐
    │ Response 200 OK                      │
    │ {                                    │
    │   available: false,                  │
    │   existsIn: "ned",                   │
    │   message: "This email is already    │
    │   registered with NED University..." │
    │ }                                    │
    └───────┬──────────────────────────────┘
            │
            ▼
    ┌──────────────────────────────────────┐
    │ Auth Form Catches Error              │
    │ Displays Toast Message               │
    │ Prevents Firebase User Creation      │
    └──────────────────────────────────────┘
```

---

## 🔀 Admin Override Scenario

```
┌─────────────────────────────┐
│ FAST Login Page             │
│ Email: admin@example.com    │
│ (In NEXT_PUBLIC_ADMIN_EMAILS)│
└────────┬────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Firebase Sign In ✅         │
    │ uid: admin123              │
    └───────┬────────────────────┘
            │
            ▼
    ┌────────────────────────────────┐
    │ Check /api/admin/isMember      │
    │ with selectedUni = "fast"       │
    └───────┬────────────────────────┘
            │
            ▼
    ┌────────────────────────────────┐
    │ Found admins/admin123 doc? YES! │
    │ isAdmin = true ✅              │
    └───────┬────────────────────────┘
            │
            ▼
    ┌────────────────────────────────┐
    │ Check universities/fast/users   │
    │ user is registered here? ✅     │
    └───────┬────────────────────────┘
            │
            ▼
    ┌──────────────────────────────────┐
    │ ALLOW Login (Admin Privilege)     │
    │ Even if also in universities/ned │
    │ Response:                        │
    │ {                                │
    │   isMember: true,                │
    │   isAdmin: true,                 │
    │   universe: "fast"               │
    │ }                                │
    └──────────────────────────────────┘
            │
            ▼
    ┌──────────────────────────────┐
    │ Grant Access to Dashboard    │
    │ Toast: "Admin access granted"│
    └──────────────────────────────┘
```

---

## 🚨 Conflict Detection Sequence

```
Time ────────────────────────────────────────────►

User Registration Flow:
T1: Create Firebase user ✅
T2: Send OTP ✅
T3: User clicks verify email
T4: Verify email endpoint called
    ├─ Check email not in OTHER uni
    ├─ Email check CLEAR ✅
    ├─ Create profile
    └─ SUCCESS ✅

T5: User has working account

────────────────────────────────────────────────

Conflict Scenario:
T1: Create Firebase user (uid=abc) ✅
T2: Send OTP ✅
T3: Admin/Bug: Email added to NED collection ⚠️
T4: User clicks verify email
    ├─ Check email not in OTHER uni
    ├─ Email check FOUND ❌
    ├─ Delete signup_otps doc
    ├─ Return 409 Conflict
    └─ ERROR ❌

T5: Client receives 409
    ├─ Delete Firebase user (cleanup)
    ├─ Redirect to select-university
    └─ User must retry with different email

────────────────────────────────────────────────
```

---

## 📈 Security Levels Before & After

### Before Fix
```
Registration Security:  🔴 NONE
  - No email uniqueness check
  - Can register same email at both universities

Login Security:        🟡 WEAK
  - Checks membership but messaging unclear
  - Users confused about which university

Account Isolation:     🔴 NONE
  - Same Firebase user in multiple universities
  - Cross-university access possible

Cleanup:              🔴 NONE
  - Orphaned accounts not cleaned up
```

### After Fix
```
Registration Security:  🟢 STRONG
  - 3-layer email validation
  - Prevents duplicate emails across universities

Login Security:        🟢 STRONG
  - Clear error messages with university names
  - Prevents cross-university login for regular users

Account Isolation:     🟢 STRONG
  - Firebase users mapped to SINGLE university
  - Firestore profiles separate per university

Cleanup:              🟢 STRONG
  - Automatic deletion of orphaned accounts
  - Consistent state maintained
```

---

## 🎯 Risk Matrix - Resolution

```
BEFORE FIX:

Risk                    Likelihood  Impact   Score
────────────────────────────────────────────────
Cross-uni access           HIGH      HIGH     🔴🔴
Email confusion            HIGH      MED      🔴🟡
Data leakage              MED       HIGH      🟡🔴
Account takeover          LOW       CRIT      🔴🔴

AFTER FIX:

Risk                    Likelihood  Impact   Score
────────────────────────────────────────────────
Cross-uni access           LOW       HIGH     🟢🟡
Email confusion            LOW       LOW      🟢🟢
Data leakage              LOW       HIGH      🟢🟡
Account takeover          VERY LOW  CRIT     🟢🟢
```

---

Generated: January 27, 2026
Type: Security Implementation Documentation
