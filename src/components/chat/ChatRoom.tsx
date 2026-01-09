import React, { useEffect, useRef, useState } from 'react';
import { useChat } from './useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ChatRoom({ chatId, university }: { chatId: string, university: string }) {
  const { messages, loading, sendMessage, setTyping, accessible } = useChat(chatId, university);
  const { user } = useUser();
  const firestore = useFirestore();
  const [meta, setMeta] = useState<any>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const cref = doc(firestore, `universities/${university}/chats`, chatId);
    getDoc(cref).then(s => { if (s.exists()) setMeta(s.data()); }).catch((err) => {
      // Surface meta fetch errors for debugging (do not show sensitive details in production)
      try { console.error('ChatRoom: failed to fetch chat meta', err); } catch (e) {}
      setMetaError(String(err?.message || err));
    });
  }, [firestore, chatId]);

  // autoscroll to bottom when messages change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (accessible === false) {
    return (
      <div className="flex flex-col h-[40vh] items-center justify-center text-center p-6">
        <ChatHeader meta={meta} />
        <div className="text-sm text-muted-foreground">Chat unavailable. Ensure you are a participant and the chat exists.</div>
        <div className="text-xs text-slate-400 mt-4">
          <div>Debug info:</div>
          <div>Current UID: {user?.uid ?? 'not-signed-in'}</div>
          <div>Chat meta fetch error: {metaError ?? 'none'}</div>
          <div className="truncate">Chat id: {chatId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <ChatHeader meta={meta} />
      <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3 bg-card">
        {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : messages.map((m) => (
          <MessageBubble key={m.id} message={m} isOwn={m.senderId === user?.uid} />
        ))}
      </div>
      <div className="p-3 border-t border-border bg-surface">
        <MessageInput onSend={async (text) => await sendMessage({ type: 'text', content: text })} onTyping={(v) => setTyping(Boolean(v))} onSendMedia={async (mediaUrl, type) => await sendMessage({ type, mediaUrl })} disabled={meta?.status !== 'active' || accessible === false} />
      </div>
    </div>
  );
}
