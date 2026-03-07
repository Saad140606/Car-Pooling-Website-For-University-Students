import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

export default function MessageInput({ onSend, onTyping, onSendMedia, disabled }: { 
  onSend: (text: string) => Promise<any>, 
  onTyping: (v: boolean) => void, 
  onSendMedia: (url: string, type: 'image' | 'video' | 'audio' | 'file') => Promise<any>,
  disabled?: boolean 
}) {
  const [text, setText] = useState('');
  const typingRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (v: string) => {
    setText(v);
    onTyping(true);
    if (typingRef.current) window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => onTyping(false), 1000);
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText('');
    onTyping(false);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      {/* Main input area */}
      <div className="flex items-end gap-2 p-2 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-xl">
        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text} 
          onChange={(e) => handleChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..." 
          rows={1}
          className="flex-1 bg-transparent text-white placeholder:text-slate-400 focus:outline-none resize-none py-2 px-2 text-sm sm:text-base max-h-[120px] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent" 
          disabled={disabled}
        />
        
        {/* Right actions */}
        <div className="flex items-center gap-1 pb-2">
          <button 
            onClick={handleSend} 
            disabled={disabled || !text.trim()}
            className="p-2.5 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
