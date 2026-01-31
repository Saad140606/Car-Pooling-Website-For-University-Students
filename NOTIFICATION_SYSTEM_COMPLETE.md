# 🔔 Campus Rides - Complete Notification System

## Overview

This document describes the production-grade notification system for Campus Rides, covering:
- Ride-related notifications (request flow, status changes)
- Chat message notifications (in-app + push)
- Audio & Video call notifications (WhatsApp-like experience)
- Smart anti-spam rules

---

## 🎯 Notification Types

| Type | Description | Priority | Sound |
|------|-------------|----------|-------|
| `chat` | New chat message | Normal | ✅ |
| `ride_request` | New ride request (driver) | High | ✅ |
| `ride_accepted` | Request accepted (passenger) | Critical | ✅ |
| `ride_rejected` | Request declined | Normal | ✅ |
| `ride_confirmed` | Passenger confirmed ride | High | ✅ |
| `ride_cancelled` | Ride/request cancelled | High | ✅ |
| `ride_expired` | Request expired | Normal | ✅ |
| `ride_reminder` | 30/10 min before departure | High | ✅ |
| `ride_started` | Driver started the ride | High | ✅ |
| `ride_completed` | Ride completed | Normal | ✅ |
| `call_incoming` | Incoming audio/video call | Critical | 🔊 Ringtone |
| `call_missed` | Missed call | High | ✅ |
| `call_ended` | Call ended | Low | ❌ |
| `verification` | Verification status | Normal | ✅ |
| `system` | System announcements | Varies | ✅ |

---

## 🚗 Part 1: Ride-Related Notifications

### Notification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    RIDE REQUEST FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Passenger                          Driver                  │
│     │                                  │                    │
│     │── Requests seat ──────────────▶ │                    │
│     │                                  │                    │
│     │                       🔔 "New Ride Request 🚗"        │
│     │                          Push + In-app                │
│     │                                  │                    │
│     │◀── Accepts request ──────────── │                    │
│     │                                  │                    │
│  🔔 "Request Accepted! ✅"             │                    │
│     Critical priority                  │                    │
│     "Confirm within 5 minutes"         │                    │
│     │                                  │                    │
│     │── Confirms ride ────────────────▶│                    │
│     │                                  │                    │
│     │                       🔔 "Ride Confirmed! 🎉"         │
│     │                                  │                    │
│     │◀── Chat enabled ────────────────│                    │
│     │                                  │                    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Files

1. **Client-side Service**: `src/lib/rideNotificationService.ts`
   - `notifyNewRideRequest()` - Driver notification
   - `notifyRequestAccepted()` - Passenger notification
   - `notifyRequestRejected()` - Passenger notification
   - `notifyRideConfirmed()` - Driver notification
   - `notifyRideCancelled()` - Both parties
   - `notifyRequestExpired()` - Passenger notification
   - `notifyRideStarted()` - Passenger notification
   - `notifyRideCompleted()` - Both parties
   - `notifyMissedCall()` - Call recipient

2. **Cloud Functions**: `functions/lib/index.js`
   - `notifyOnBookingRequest` - Firestore trigger for new requests
   - `notifyOnRequestAccepted` - Handles all status changes
   - `notifyOnBookingUpdate` - Booking status notifications
   - `notifyOnRideUpdate` - Ride status change notifications
   - `rideReminders` - 30/10 minute departure reminders

---

## 💬 Part 2: Chat Message Notifications

### Features
- ✅ In-app premium notifications with sender avatar
- ✅ Push notifications via FCM
- ✅ Message preview in notification
- ✅ Verified badge indicator
- ✅ 10-second throttle to prevent spam

### Flow

```
┌──────────────────────────────────────────────┐
│         CHAT MESSAGE NOTIFICATION            │
├──────────────────────────────────────────────┤
│                                              │
│  Sender                    Recipient         │
│    │                           │             │
│    │── Sends message ─────────▶│             │
│    │                           │             │
│    │                  🔔 "New Message"       │
│    │                     [Avatar] Name       │
│    │                     "Message preview"   │
│    │                           │             │
│    │                  📲 Push if in BG       │
│    │                           │             │
└──────────────────────────────────────────────┘
```

### Implementation

**Client-side**: `src/firebase/firestore/chats.ts`
```typescript
// sendMessage() creates notification for recipient
await createNotification(firestore, universityId, message.recipientId, 'chat', {
  relatedChatId: chatId,
  title: 'New Message',
  message: `${message.senderName} sent you a message`,
  metadata: { senderName, senderId, messageType }
});
```

**Cloud Functions**: `notifyOnMessageCreate`
- Triggers on new message in `universities/{univ}/chats/{chatId}/messages/{msgId}`
- 10-second throttle per user to prevent notification spam
- Supports media messages (photo/video indicators)

---

## 📞 Part 3: Audio & Video Call Notifications

### WhatsApp-Like Calling Experience

```
┌────────────────────────────────────────────────────────────┐
│              INCOMING CALL SCREEN                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    ╭──────────────╮                        │
│                    │              │                        │
│                    │   [Avatar]   │  ← Ripple animation   │
│                    │     + ✓      │  ← Verified badge     │
│                    │              │                        │
│                    ╰──────────────╯                        │
│                                                            │
│                    John Smith ✓                            │
│                  "Incoming video call..."                  │
│                                                            │
│               ╭────────╮    ╭────────╮                    │
│               │   ✗    │    │   ✓    │                    │
│               │ Decline│    │ Accept │                    │
│               ╰────────╯    ╰────────╯                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Features

- ✅ Full-screen incoming call overlay (z-index: 100)
- ✅ Animated ripple effects around caller avatar
- ✅ Caller name + verified badge (green checkmark)
- ✅ Proper ringtone management via `ringtoneManager`
- ✅ Ringtone stops on accept/reject
- ✅ 30-second timeout → missed call notification
- ✅ Picture-in-picture for video calls
- ✅ Mute/Video toggle controls
- ✅ Call duration timer

### Missed Call Detection

```typescript
// CallingContext.tsx
const CALL_TIMEOUT_MS = 30000; // 30 seconds

// Timer starts when call comes in
incomingCallTimerRef.current = setTimeout(() => {
  if (call && call.status === 'ringing') {
    handleMissedCall(call);
  }
}, CALL_TIMEOUT_MS);

// Missed call creates notification
await notifyMissedCall(firestore, university, userId, callerName, callerId, callType);
```

### Implementation Files

1. **Calling Context**: `src/contexts/CallingContext.tsx`
   - Manages call state (incoming, active, ended)
   - Missed call detection with 30s timeout
   - Integrates with `rideNotificationService` for missed call notifications

2. **Incoming Call UI**: `src/components/calling/IncomingCallScreen.tsx`
   - Premium animated UI
   - Proper ringtone cleanup
   - Verified badge support

3. **Active Call UI**: `src/components/calling/ActiveCallScreen.tsx`
   - Video/audio display
   - Call controls (mute, video toggle, end)
   - Duration timer

4. **WebRTC Service**: `src/lib/webrtcCallingService.ts`
   - Call signaling via Firestore
   - ICE candidate management
   - Call lifecycle handling

5. **Ringtone Manager**: `src/lib/ringtoneManager.ts`
   - Ringtone playback and stop
   - Notification sounds
   - Vibration patterns

---

## 🎨 Part 4: Premium Notification UI

### PremiumNotification Component

**File**: `src/components/premium/PremiumNotification.tsx`

Features:
- ✅ Beautiful gradient backgrounds per type
- ✅ Animated entry/exit (spring physics)
- ✅ Auto-dismiss with progress bar
- ✅ Sender avatar with verified badge
- ✅ Action buttons support
- ✅ Critical priority indicator (pulsing dot)
- ✅ Max 5 visible, sorted by priority

### Color Scheme

| Type | Gradient | Icon |
|------|----------|------|
| Chat | Blue | MessageSquare |
| Ride Request | Purple | Car |
| Ride Accepted | Emerald | UserCheck |
| Ride Rejected | Red | XCircle |
| Ride Confirmed | Green | Check |
| Ride Cancelled | Red | AlertCircle |
| Ride Expired | Orange | Clock |
| Ride Reminder | Amber | Bell |
| Ride Started | Cyan | MapPin |
| Ride Completed | Teal | Sparkles |
| Call Incoming | Green | Phone |
| Call Missed | Rose | PhoneMissed |
| Verification | Emerald | ShieldCheck |

---

## 🛡️ Part 5: Smart Anti-Spam Rules

### Deduplication Strategy

1. **Client-side Cache** (`rideNotificationService.ts`):
   ```typescript
   const DEDUP_WINDOW_MS = 30000; // 30 seconds
   const notificationCache = new Map<string, number>();
   
   function isDuplicate(userId, type, relatedId): boolean {
     const key = `${userId}:${type}:${relatedId}`;
     // Check if sent within window
   }
   ```

2. **NotificationContext Dedup**:
   ```typescript
   const recentNotificationIds = new Set<string>();
   const DEDUP_WINDOW_MS = 30000;
   
   function shouldShowNotification(id): boolean {
     // Skip if already shown within window
   }
   ```

3. **Cloud Function Throttling** (`functions/lib/index.js`):
   ```javascript
   // Per-user throttle stored in fcm_tokens/{uid}/throttles/{key}
   if (opts?.throttleKey && opts?.throttleSeconds) {
     // Skip if sent recently
   }
   ```

### Throttle Settings

| Notification Type | Throttle Window |
|------------------|-----------------|
| Chat messages | 10 seconds |
| Ride requests | 30 seconds |
| Call notifications | No throttle |
| System notifications | 60 seconds |

### Priority Rules

1. **Critical** (persistent until dismissed):
   - Incoming calls
   - Request accepted (needs immediate action)
   
2. **High** (6 second display):
   - New ride requests
   - Ride confirmed
   - Ride cancelled
   - Missed calls
   - Ride reminders

3. **Normal** (5 second display):
   - Chat messages
   - Ride completed
   - Request rejected/expired

4. **Low** (4 second display):
   - Call ended
   - System info

---

## 🔧 Configuration

### FCM Setup

1. Ensure Firebase project has FCM enabled
2. Generate VAPID key for web push
3. Store FCM tokens at `fcm_tokens/{userId}`

### Environment Variables

```env
NEXT_PUBLIC_FIREBASE_MESSAGING_VAPID_KEY=your_vapid_key
```

### Firestore Collections

```
universities/{univ}/notifications
├── userId: string
├── type: NotificationType
├── title: string
├── message: string
├── isRead: boolean
├── createdAt: Timestamp
├── priority: 'critical' | 'high' | 'normal' | 'low'
├── relatedRideId: string
├── relatedChatId?: string
├── relatedBookingId?: string
└── metadata: object
```

---

## 📱 PWA Support

- System notifications work when app is in background
- App badge shows unread count
- Push notifications via FCM service worker
- Vibration patterns for mobile devices

---

## ✅ Testing Checklist

- [ ] Ride request creates notification for driver
- [ ] Request accepted shows premium notification to passenger
- [ ] Confirmation shows notification to driver
- [ ] Cancellation notifies both parties
- [ ] Chat messages trigger in-app + push
- [ ] Incoming call shows full-screen UI
- [ ] Missed call creates notification
- [ ] No duplicate notifications within 30s
- [ ] Critical notifications persist until dismissed
- [ ] App badge updates correctly
- [ ] PWA background notifications work

---

## 🎬 Demo Flow

1. **Passenger** searches for rides
2. **Passenger** requests seat → **Driver** gets 🔔
3. **Driver** accepts → **Passenger** gets 🔔 (critical)
4. **Passenger** confirms → **Driver** gets 🔔
5. **Driver** starts chat → **Passenger** gets 🔔
6. **Driver** calls → **Passenger** sees full-screen incoming call
7. **Passenger** misses call → Gets missed call 🔔
8. 30 min before → Both get reminder 🔔
9. 10 min before → Both get reminder 🔔
10. **Driver** completes → **Passenger** gets 🔔

---

*Last updated: Production-ready notification system*
