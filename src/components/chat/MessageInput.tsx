import React, { useState, useRef } from 'react';
import MediaUploader from './MediaUploader';

export default function MessageInput({ onSend, onTyping, onSendMedia, disabled }: { onSend: (text: string) => Promise<any>, onTyping: (v: boolean) => void, onSendMedia: (url: string, type: string) => Promise<any>, disabled?: boolean }) {
  const [text, setText] = useState('');
  const typingRef = useRef<number | null>(null);

  const handleChange = (v: string) => {
    setText(v);
    onTyping(true);
    if (typingRef.current) window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => onTyping(false), 1000);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText('');
    onTyping(false);
  };

  return (
    <div className="flex items-center gap-2">
      <MediaUploader onUploaded={async (url, type) => { await onSendMedia(url, type); }} />
      <input value={text} onChange={(e) => handleChange(e.target.value)} placeholder="Type a message..." className="flex-1 rounded-md px-3 py-2 bg-white/5 text-white" disabled={disabled} />
      <button onClick={handleSend} disabled={disabled || text.trim().length===0} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Send</button>
    </div>
  );
}
