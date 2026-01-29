import React, { useState, useRef } from 'react';
import { Check, CheckCheck, Play, Pause } from 'lucide-react';

export default function MessageBubble({ message, isOwn, senderName, senderInitials }: { message: any, isOwn: boolean, senderName?: string, senderInitials?: string }) {
  const ts = message.timestamp && message.timestamp.toDate ? message.timestamp.toDate() : (message.timestamp ? new Date(message.timestamp) : null);
  const isSeen = message.seenBy && Array.isArray(message.seenBy) && message.seenBy.length > 1;
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleAudioEnd = () => {
    setPlaying(false);
  };
  
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 animate-in slide-in-from-bottom-3 duration-300`}>
      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        {!isOwn && (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg">
            {senderInitials || '?'}
          </div>
        )}
        
        <div className="flex flex-col gap-1">
          {/* Sender name for received messages */}
          {!isOwn && senderName && (
            <span className="text-xs text-slate-400 px-2">{senderName}</span>
          )}
          
          {/* Message bubble */}
          <div className={`relative group`}>
            <div className={`p-3 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-200 hover:shadow-xl ${
              isOwn 
                ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-white rounded-br-md' 
                : 'bg-gradient-to-br from-slate-700/90 to-slate-800/90 text-white rounded-bl-md border border-slate-600/30'
            }`}>
              {/* Text message */}
              {message.type === 'text' && (
                <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">{message.content}</div>
              )}
              
              {/* Voice message */}
              {message.type === 'audio' && message.mediaUrl && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className={`p-2 rounded-full transition-colors ${
                      isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/20 hover:bg-primary/30'
                    }`}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                  </button>
                  <div className="flex-1 flex items-center gap-1 h-6">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          isOwn ? 'bg-white/40' : 'bg-primary/40'
                        }`}
                        style={{ 
                          height: `${Math.random() * 16 + 8}px`,
                          opacity: playing ? 0.8 : 0.4
                        }}
                      />
                    ))}
                  </div>
                  <audio
                    ref={audioRef}
                    src={message.mediaUrl}
                    onEnded={handleAudioEnd}
                    className="hidden"
                  />
                </div>
              )}
              
              {/* Image message */}
              {message.type === 'image' && message.mediaUrl && (
                <div className="mt-1">
                  <img 
                    src={message.mediaUrl} 
                    alt="Shared image" 
                    className="max-h-48 sm:max-h-64 rounded-xl w-full object-cover cursor-pointer transition-transform hover:scale-[1.02]" 
                    loading="lazy"
                    onClick={() => window.open(message.mediaUrl, '_blank')}
                  />
                </div>
              )}
              
              {/* Video message */}
              {message.type === 'video' && message.mediaUrl && (
                <div className="mt-1">
                  <video 
                    src={message.mediaUrl} 
                    controls 
                    className="max-h-48 sm:max-h-64 rounded-xl w-full"
                    preload="metadata"
                  />
                </div>
              )}
              
              {/* Timestamp and status */}
              <div className="flex items-center gap-1.5 justify-end mt-1.5">
                <span className={`text-[0.65rem] font-medium ${
                  isOwn ? 'text-white/80' : 'text-slate-400'
                }`}>
                  {ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                {isOwn && (
                  <span className="text-white/80">
                    {isSeen ? (
                      <CheckCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
