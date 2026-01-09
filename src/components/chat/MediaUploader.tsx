import React, { useState } from 'react';
import { uploadFile } from '@/firebase/storage/upload';

export default function MediaUploader({ onUploaded }: { onUploaded: (url: string, type: 'image'|'video') => void }) {
  const [progress, setProgress] = useState(0);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const type = f.type.startsWith('video') ? 'video' : 'image';
    try {
      const path = `uploads/chats/${Date.now()}_${f.name}`;
      const url = await uploadFile(f, path, (p) => setProgress(p));
      onUploaded(url, type as 'image'|'video');
    } catch (e) {
      console.error(e);
    } finally {
      setProgress(0);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer">
        <input type="file" accept="image/*,video/*" className="hidden" onChange={onChange} />
        <div className="p-2 rounded-md hover:bg-white/5">📎</div>
      </label>
      {progress > 0 && <div className="text-xs text-muted-foreground">Uploading {Math.round(progress)}%</div>}
    </div>
  );
}
