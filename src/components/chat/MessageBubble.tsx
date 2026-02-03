import React, { useState, useRef } from 'react';
import { Check, CheckCheck, Play, Pause, Download, FileText, Music } from 'lucide-react';
import { InlineVerifiedBadge } from '@/components/VerificationBadge';

export default function MessageBubble({ message, isOwn, senderName, senderInitials, senderVerified }: { message: any, isOwn: boolean, senderName?: string, senderInitials?: string, senderVerified?: boolean }) {
  const ts = message.timestamp && message.timestamp.toDate ? message.timestamp.toDate() : (message.timestamp ? new Date(message.timestamp) : null);
  const isSeen = message.seenBy && Array.isArray(message.seenBy) && message.seenBy.length > 1;
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [downloading, setDownloading] = useState(false);
  
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

  const getFileNameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      // Remove timestamp and underscores prefix
      return decodeURIComponent(filename.replace(/^[0-9]+_/, ''));
    } catch {
      return 'Download';
    }
  };

  const getFileExtension = (fileName: string): string => {
    const match = fileName.match(/\.([^.]+)$/);
    return match ? match[1].toUpperCase() : 'FILE';
  };

  const handleDownload = async () => {
    if (!message.mediaUrl) return;
    setDownloading(true);
    try {
      const response = await fetch(message.mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFileNameFromUrl(message.mediaUrl);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const isImageType = (type: string): boolean => {
    return type === 'image' || (message.mediaUrl && 
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(message.mediaUrl));
  };

  const isVideoType = (type: string): boolean => {
    return type === 'video' || (message.mediaUrl && 
      /\.(mp4|webm|ogg|mov|avi)$/i.test(message.mediaUrl));
  };

  const isAudioType = (type: string): boolean => {
    return type === 'audio' || (message.mediaUrl && 
      /\.(mp3|wav|ogg|webm|m4a|aac|flac)$/i.test(message.mediaUrl));
  };

  const isFileType = (type: string): boolean => {
    return type === 'file' || (message.mediaUrl && 
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i.test(message.mediaUrl));
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
          {/* Sender name for received messages - with verified badge */}
          {!isOwn && senderName && (
            <div className="flex items-center gap-1 px-2">
              <span className="text-xs text-slate-400">{senderName}</span>
              <InlineVerifiedBadge verified={senderVerified} className="ml-0.5" />
            </div>
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
              
              {/* Voice message / Audio */}
              {isAudioType(message.type) && message.mediaUrl && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                      isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/20 hover:bg-primary/30'
                    }`}
                    title={playing ? 'Pause' : 'Play'}
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
              {isImageType(message.type) && message.mediaUrl && (
                <div className="mt-1">
                  <img 
                    src={message.mediaUrl} 
                    alt="Shared image" 
                    className="max-h-48 sm:max-h-64 rounded-xl w-full object-cover cursor-pointer transition-transform hover:scale-[1.02]" 
                    loading="lazy"
                    onClick={() => window.open(message.mediaUrl, '_blank')}
                    onError={(e) => console.error('Image load error:', e)}
                  />
                </div>
              )}
              
              {/* Video message */}
              {isVideoType(message.type) && message.mediaUrl && (
                <div className="mt-1">
                  <video 
                    src={message.mediaUrl} 
                    controls 
                    className="max-h-48 sm:max-h-64 rounded-xl w-full object-cover"
                    preload="metadata"
                    onError={(e) => console.error('Video load error:', e)}
                  />
                </div>
              )}
              
              {/* File attachment */}
              {isFileType(message.type) && message.mediaUrl && (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  isOwn ? 'bg-white/10' : 'bg-slate-600/30'
                }`}>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOwn ? 'bg-white/20' : 'bg-primary/20'
                  }`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getFileNameFromUrl(message.mediaUrl)}
                    </p>
                    <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-slate-400'}`}>
                      {getFileExtension(getFileNameFromUrl(message.mediaUrl))}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                      isOwn 
                        ? 'hover:bg-white/20 text-white' 
                        : 'hover:bg-primary/30 text-primary'
                    } disabled:opacity-50`}
                    title="Download"
                  >
                    {downloading ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Generic file message (if type doesn't match known types but has mediaUrl) */}
              {message.mediaUrl && !isImageType(message.type) && !isVideoType(message.type) && 
               !isAudioType(message.type) && !isFileType(message.type) && message.type !== 'text' && (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  isOwn ? 'bg-white/10' : 'bg-slate-600/30'
                }`}>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOwn ? 'bg-white/20' : 'bg-primary/20'
                  }`}>
                    <Music className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getFileNameFromUrl(message.mediaUrl)}
                    </p>
                    <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-slate-400'}`}>
                      {message.type || 'Media'}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                      isOwn 
                        ? 'hover:bg-white/20 text-white' 
                        : 'hover:bg-primary/30 text-primary'
                    } disabled:opacity-50`}
                    title="Download"
                  >
                    {downloading ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
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
