# Chat System (Realtime) — Design & Rules

Overview
- One chat per ride exists under `universities/{universityId}/chats/{chatId}`.
- Each chat document includes `rideId` and `participants: string[]` (user UIDs).
- Messages are stored in `universities/{universityId}/chats/{chatId}/messages/{messageId}` and ordered by `createdAt`.

Security
- Only participants listed in `chat.participants` can read or write messages.
- Messages are writable only by the authenticated `senderId` matching the request auth.

Server-side helper functions
- `createChatForRide(db, universityId, rideId, participants)` — creates a new chat doc.
- `sendMessage(db, universityId, chatId, senderId, text)` — writes a message with a server timestamp.
- `chatMessagesQuery(db, universityId, chatId)` — returns an ordered query for messages.

Client example (Next.js 15, client component)
```tsx
'use client';
import { useFirestore } from '@/firebase';
import { useChatMessages } from '@/firebase/firestore/use-chat-messages';
import { sendMessage } from '@/firebase/firestore/chats';
import { useUser } from '@/firebase';

export default function Chat({ universityId, chatId }) {
  const db = useFirestore();
  const { user } = useUser();
  const { messages, loading } = useChatMessages(db, universityId, chatId);

  const handleSend = async (text: string) => {
    if (!user) return;
    await sendMessage(db, universityId, chatId, user.uid, text);
  };

  return (
    <div>
      {loading ? 'Loading...' : messages.map(m => <div key={m.id}><strong>{m.senderId}</strong>: {m.text}</div>)}
      {/* input, send button, etc. */}
    </div>
  );
}
```

Testing in emulator
- Use Auth emulator to create test users and set `users/{uid}.university` in Firestore emulator (or let the app create it on first sign-in).
- Create a ride, then create a chat for that ride with the driver and passenger uids included in participants, then send messages.

This design keeps chat access strictly limited to ride participants and aligns with the security rules in `firestore.rules`.