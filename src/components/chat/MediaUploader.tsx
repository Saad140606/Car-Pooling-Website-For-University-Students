import React, { useState, useRef } from 'react';
import { uploadFile } from '@/firebase/storage/upload';
import { Paperclip, Loader2, AlertCircle } from 'lucide-react';

export default function MediaUploader({ onUploaded }: { onUploaded: (url: string, type: 'image'|'file') => void }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_RETRIES = 3;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for all file types

  const uploadWithRetry = async (
    file: File,
    path: string,
    retries: number = 0
  ): Promise<string> => {
    try {
      const url = await uploadFile(file, path, (p) => {
        setProgress(Math.min(p, 99)); // Never show 100% until fully complete
      });
      setProgress(100);
      return url;
    } catch (err: any) {
      console.error(`[MediaUploader] Upload attempt ${retries + 1} failed:`, err);
      
      if (retries < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retries) * 1000;
        setError(`Upload failed. Retrying in ${delay / 1000}s...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        setRetryCount(retries + 1);
        return uploadWithRetry(file, path, retries + 1);
      }
      
      throw new Error(
        err?.message || 
        'Upload failed after multiple attempts. Check your connection and try again.'
      );
    }
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    setError(null);
    setRetryCount(0);
    
    // Validate file size
    if (f.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    // Determine file type
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    const isAudio = f.type.startsWith('audio/');
    const isPDF = f.type === 'application/pdf';
    const isDoc = f.type === 'application/msword' || 
                  f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (!isImage && !isVideo && !isAudio && !isPDF && !isDoc) {
      setError('Unsupported file type. Please upload images, videos, audio, PDFs, or documents.');
      return;
    }

    const type: 'image' | 'file' = isImage ? 'image' : 'file';
    
    setUploading(true);
    setProgress(0);
    
    try {
      const sanitizedName = f.name.replace(/[^a-z0-9._-]/gi, '_');
      const path = `uploads/chats/${Date.now()}_${sanitizedName}`;
      
      console.debug('[MediaUploader] Starting upload:', { name: f.name, size: f.size, type });
      
      const url = await uploadWithRetry(f, path);
      
      console.debug('[MediaUploader] Upload complete:', { url, type });
      
      // Ensure callback completes before resetting state
      await onUploaded(url, type);
      
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: any) {
      console.error('[MediaUploader] Upload failed:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setProgress(0);
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30">
        <AlertCircle className="h-4 w-4 text-red-400" />
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-red-300 truncate">{error}</span>
          <button
            onClick={() => {
              setError(null);
              if (inputRef.current) inputRef.current.click();
            }}
            className="text-xs px-2 py-1 rounded bg-red-600/50 hover:bg-red-600 text-white transition-colors whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer">
        <input 
          ref={inputRef}
          type="file" 
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx" 
          className="hidden" 
          onChange={onChange}
          disabled={uploading}
        />
        <div className="p-2 rounded-md hover:bg-white/10 transition-colors cursor-pointer">
          {uploading ? (
            <div className="relative h-5 w-5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <Paperclip className="h-5 w-5 text-slate-400 hover:text-slate-300 transition-colors" />
          )}
        </div>
      </label>
      {uploading && progress > 0 && (
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400 min-w-[30px]">
            {Math.round(progress)}%
          </div>
          <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
