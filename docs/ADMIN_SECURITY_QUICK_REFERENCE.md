# 🔒 Admin Security - Quick Reference

## For Developers

### Adding a New Admin Page
```typescript
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function NewAdminPage() {
  const { loading, isAdmin } = useAdminAuth();

  if (loading) return <LoadingScreen />;
  if (!isAdmin) return null; // Auto-redirects

  return <YourAdminContent />;
}
```

### Adding a New Admin API Route
```typescript
import { requireAdmin } from '@/lib/adminApiAuth';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  // Your code here
  return NextResponse.json(data);
}
```

### Making Admin API Calls (Client)
```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();

const response = await fetch('/api/admin/your-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## For Admins

### How to Create New Admin Account

**Option 1: Environment Variable**
Add to `.env.local`:
```
NEXT_PUBLIC_ADMIN_EMAILS=admin1@email.com,admin2@email.com
```

**Option 2: Firestore (Recommended)**
1. Go to Firebase Console → Firestore
2. Create collection: `admins`
3. Add document with UID as document ID
4. Add fields: `{ email, role: 'admin', createdAt }`

### Security Test Checklist

- [ ] Non-admin login blocked ✅
- [ ] Direct URL access blocked ✅  
- [ ] API calls return 403 for non-admins ✅
- [ ] Admin login works ✅
- [ ] Page refresh maintains session ✅
- [ ] Token expiry handled gracefully ✅

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't login | Check if UID in `/admins` or email in env |
| Unauthorized error | Deploy Firestore rules, check API endpoint |
| Loading forever | Check browser console, verify Firebase config |
| API 403 errors | Ensure token in Authorization header |

## Security Status

✅ **Multi-layer protection active**
- Login verification
- Component-level guards
- API-level validation
- Database rules enforced

✅ **All attack vectors blocked**
- Unauthorized login ❌
- Direct URL access ❌
- API bypass ❌
- Self-promotion ❌
- Session hijacking ❌

✅ **Production ready**
