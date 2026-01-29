import React, { useState, useRef } from 'react';
import { uploadFile } from '@/firebase/storage/upload';
import { Paperclip, Loader2 } from 'lucide-react';

export default function MediaUploader({ onUploaded }: { onUploaded: (url: string, type: 'image'|'video') => void }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    // Validate file size (max 10MB)
    if (f.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    const type = f.type.startsWith('video') ? 'video' : 'image';
    setUploading(true);
    try {
      const path = `uploads/chats/${Date.now()}_${f.name}`;
      const url = await uploadFile(f, path, (p) => setProgress(p));
      onUploaded(url, type as 'image'|'video');
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      console.error('Upload failed:', e);
      alert('Upload failed. Please try again.');
    } finally {
      setProgress(0);
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer">
        <input 
          ref={inputRef}
          type="file" 
          accept="image/*,video/*" 
          className="hidden" 
          onChange={onChange}
          disabled={uploading}
        />
        <div className="p-2 rounded-md hover:bg-white/10 transition-colors">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Paperclip className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </label>
      {progress > 0 && (
        <div className="text-xs text-slate-400">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}
