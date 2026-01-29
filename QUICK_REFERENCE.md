# Campus Ride - Quick Reference Guide

## 🚀 QUICK START

### 1. Authentication (Persistent Login)
✅ **Already working** - Users automatically stay logged in

```typescript
// Check if user is authenticated
import { useUser } from '@/firebase/auth/use-user';

function MyComponent() {
  const { user, loading, initialized } = useUser();
  
  if (!initialized) return <Loading />;
  if (!user) return <LoginPage />;
  
  return <Dashboard />;
}
```

### 2. Protect Routes
✅ **Use AuthGuard** - Wraps sensitive content

```tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
```

### 3. Notifications
✅ **Already initialized** - Listen to notifications

```typescript
import { useNotificationManager } from '@/hooks/useNotificationManager';

function NotificationBadge() {
  const { unreadCount, clearNotification } = useNotificationManager();
  
  return (
    <div>
      <span className="badge">{unreadCount.total}</span>
      <span className="chat-badge">{unreadCount.chat}</span>
      <span className="ride-badge">{unreadCount.ride_status}</span>
    </div>
  );
}
```

**Notification Types:**
- `chat` - Chat messages
- `ride_request` - Booking requests
- `ride_accepted` - Ride accepted
- `ride_confirmed` - Ride confirmed
- `ride_cancelled` - Ride cancelled

### 4. Voice Messages
✅ **Ready to use** - Just add VoiceRecorder component

```tsx
import VoiceRecorder from '@/components/chat/VoiceRecorder';

function ChatInput() {
  const handleSendVoice = (url: string) => {
    // Send voice message
    sendMessage({
      type: 'audio',
      mediaUrl: url,
      duration: audioLength
    });
  };

  return <VoiceRecorder onSend={handleSendVoice} />;
}
```

### 5. Audio Calling
✅ **Ready to use** - Use CallingContext

```tsx
import { useCallingContext } from '@/contexts/CallingContext';

function CallButton({ userId, userName }) {
  const { initiateCall } = useCallingContext();

  return (
    <button onClick={() => initiateCall(userId, userName, 'audio')}>
      📞 Call
    </button>
  );
}
```

### 6. Video Calling
✅ **Same as audio** - Pass 'video' instead of 'audio'

```tsx
<button onClick={() => initiateCall(userId, userName, 'video')}>
  📹 Video Call
</button>
```

---

## 📊 ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────┐
│       Application Root (layout.tsx)     │
├─────────────────────────────────────────┤
│ • FirebaseClientProvider                │
│ • CallingProvider                       │
│ • NotificationProvider                  │
│ • IncomingCallScreen (overlay)          │
│ • ActiveCallScreen (overlay)            │
│ • BackgroundCallHandler                 │
└─────────────────────────────────────────┘
          ↓         ↓         ↓
    ┌─────────────────────────┐
    │   Page Components       │
    │ • Dashboard             │
    │ • Chats                 │
    │ • Rides                 │
    │ • Profile               │
    └─────────────────────────┘
          ↓         ↓
    ┌─────────────────────────┐
    │   Services/Hooks        │
    │ • useUser               │
    │ • useCallingContext     │
    │ • useNotificationMgr    │
    │ • voiceMessageService   │
    └─────────────────────────┘
```

---

## 🔧 SERVICES OVERVIEW

| Service | Purpose | Export |
|---------|---------|--------|
| `sessionManager` | Login persistence | `{ saveSession, getStoredSession, clearSession }` |
| `notificationManager` | Notification handling | `{ subscribe, emit, getTotalCount }` |
| `voiceMessageService` | Voice messages | `{ startRecording, stopRecording, playVoiceMessage, uploadVoiceMessage }` |
| `webrtcCallingService` | WebRTC calls | `{ initiateCall, acceptCall, rejectCall, endCall }` |

---

## 🎯 COMMON TASKS

### Send a Chat Notification
```javascript
// Backend/Cloud Function
admin.messaging().send({
  notification: {
    title: "New Message from Alice",
    body: "Hey, how are you?"
  },
  data: {
    type: "chat",
    relatedChatId: "chat-123",
    senderId: "alice-uid",
    senderName: "Alice"
  },
  token: userFCMToken
});
```

### Send a Ride Status Notification
```javascript
admin.messaging().send({
  notification: {
    title: "Ride Accepted!",
    body: "Driver Bob accepted your ride request"
  },
  data: {
    type: "ride_accepted",
    relatedRideId: "ride-456",
    senderId: "bob-uid",
    senderName: "Bob"
  },
  token: userFCMToken
});
```

### Display Incoming Call Badge
```tsx
function Header() {
  const { incomingCall } = useCallingContext();
  
  return (
    <div>
      {incomingCall && (
        <div className="animate-pulse bg-red-600 px-3 py-1 rounded-full">
          Incoming call from {incomingCall.callerName}
        </div>
      )}
    </div>
  );
}
```

### Record and Send Voice Message
```tsx
function VoiceMessageUI() {
  const handleVoiceSent = async (url: string) => {
    const message = {
      type: 'audio',
      mediaUrl: url,
      senderId: currentUser.uid,
      senderName: currentUser.name,
      createdAt: new Date(),
      seenBy: [currentUser.uid]
    };
    
    await db.collection('chats').doc(chatId)
      .collection('messages').add(message);
  };

  return <VoiceRecorder onSend={handleVoiceSent} />;
}
```

---

## 🐛 DEBUGGING

### Enable Console Debug Logs
All services use prefixed logs:
```javascript
// In browser console
// Look for:
[SessionManager]        // Auth persistence
[NotificationManager]   // Notifications
[VoiceMessageService]   // Voice recording/playback
[WebRTCCalling]        // Call signaling
[CallingProvider]      // Call state
[BackgroundCallHandler] // Background handling
```

### Check Current State
```javascript
// In browser console

// Check auth
firebase Auth: window.firebaseAuth.currentUser

// Check session
JSON.parse(localStorage.getItem('campus_ride_session'))

// Check notification count
notificationManager.getTotalCount()

// Check current call
webrtcCallingService.getCurrentCall()

// Check local stream
webrtcCallingService.getLocalMediaStream()
```

### Common Issues

**Issue:** User logged out after app restart
- **Solution:** Check if localStorage is cleared (private browsing?)
- Check: `localStorage.getItem('campus_ride_session')`

**Issue:** Notifications not appearing
- **Solution:** Check browser notification permission
- Check: `Notification.permission` (should be 'granted')
- Check FCM token in Firestore: `db.collection('fcm_tokens').doc(userId).get()`

**Issue:** Call doesn't connect
- **Solution:** Check internet connection
- Check: `navigator.onLine` (should be true)
- Check: Microphone/camera permissions granted
- Try: Different browser or device

**Issue:** Voice message upload fails
- **Solution:** Check internet connection
- Check: File size (should be < 2GB)
- Check: Firebase Storage permissions
- Check: Browser supports MediaRecorder

---

## 📱 MOBILE CONSIDERATIONS

### iOS Specific
- 🔴 **Issue:** Limited background audio in WebView
- ✅ **Solution:** Use native app wrapper or progressive web app

### Android Specific
- ✅ Background notifications work well
- ✅ Call background handling works well
- 🟡 **Note:** Some Android versions may kill connections after 10+ min

### Low Bandwidth
- ✅ Voice messages work (8kHz if needed)
- 🟡 Video calls may buffer (reduce quality)
- ✅ Audio calls work fine

---

## 📈 PERFORMANCE TIPS

1. **Lazy Load Calling UI**
   ```tsx
   const IncomingCallScreen = lazy(() => 
     import('./calling/IncomingCallScreen')
   );
   ```

2. **Debounce Notifications**
   ```typescript
   // Prevent spam from multiple same notifications
   const seenNotifications = new Set();
   if (!seenNotifications.has(notification.relatedId)) {
     showNotification(notification);
     seenNotifications.add(notification.relatedId);
   }
   ```

3. **Clean Up Streams**
   ```typescript
   // Always stop media tracks when call ends
   stream.getTracks().forEach(track => track.stop());
   ```

---

## 🔒 SECURITY CHECKLIST

Before deploying:

- [ ] HTTPS enabled (required for WebRTC/media)
- [ ] Firebase VAPID key set
- [ ] Firestore rules deployed
- [ ] Service worker deployed
- [ ] Environment variables configured
- [ ] CORS properly configured
- [ ] API keys restricted to appropriate domains

---

## 📚 FILE LOCATIONS

**Core Services:**
- Auth: `src/firebase/auth/use-user.tsx`
- Persistence: `src/lib/sessionManager.ts`
- Notifications: `src/lib/notificationManager.ts`
- Voice: `src/lib/voiceMessageService.ts`
- Calling: `src/lib/webrtcCallingService.ts`

**Components:**
- AuthGuard: `src/components/AuthGuard.tsx`
- HomePageClient: `src/components/HomePageClient.tsx`
- Incoming Call: `src/components/calling/IncomingCallScreen.tsx`
- Active Call: `src/components/calling/ActiveCallScreen.tsx`
- VoiceRecorder: `src/components/chat/VoiceRecorder.tsx`

**Contexts:**
- Calling: `src/contexts/CallingContext.tsx`
- Notifications: `src/contexts/NotificationContext.tsx`

**Hooks:**
- useNotificationManager: `src/hooks/useNotificationManager.ts`

---

## 🚢 DEPLOYMENT

### Pre-Deployment Checklist

```bash
# 1. Test all features locally
npm run dev

# 2. Build for production
npm run build

# 3. Check for TypeScript errors
npm run typecheck

# 4. Deploy
npm run start
```

### Environment Variables Required
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
NEXT_PUBLIC_FIREBASE_VAPID_KEY=xxx  # CRITICAL for FCM
```

### Firebase Rules Update
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules
```

---

## 💡 TIPS & TRICKS

1. **Test Notifications in Dev**
   ```javascript
   // In browser console
   notificationManager.handleFCMMessage({
     data: {
       type: 'chat',
       title: 'Test',
       body: 'Test message',
       relatedId: 'test-1'
     }
   });
   ```

2. **Simulate Network Offline**
   ```javascript
   // In browser console or DevTools
   // Application tab → Service Workers → Offline checkbox
   // Or: DevTools Network tab → Throttling
   ```

3. **Test Call Audio/Video**
   ```javascript
   // Use browser's built-in testing
   // Settings → Privacy → Microphone/Camera
   // Or: DevTools → Sensors tab
   ```

4. **View Firestore Data**
   - Firebase Console → Firestore Database
   - Collections: `calls`, `fcm_tokens`, `messages`

---

## 🆘 SUPPORT

### Quick Fixes
1. Clear browser cache and localStorage
2. Restart the app
3. Check internet connection
4. Check browser permissions (microphone, camera, notifications)
5. Update browser to latest version

### Debug Logging
Enable detailed logs by setting in `src/lib/`:
```javascript
const DEBUG = true;  // Set to enable all logs
```

### Community
- Check existing issues in repository
- Search Discord/Slack for similar problems
- Review implementation guide: `REALTIME_FEATURES_IMPLEMENTATION.md`

---

**Last Updated:** January 29, 2026  
**Status:** ✅ Complete and Production-Ready
