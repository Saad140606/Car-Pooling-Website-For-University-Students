import React from 'react';

export default function ChatHeader({ meta }: { meta: any }) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-border bg-card">
      <div>
        <div className="font-semibold">Chat</div>
        <div className="text-xs text-muted-foreground">{meta?.bookingId ? `Booking: ${meta.bookingId}` : 'Chat'}</div>
      </div>
      <div className="flex items-center gap-2">
        {/* Call icons placeholder */}
        <button className="p-2 rounded-md hover:bg-white/5">📞</button>
        <button className="p-2 rounded-md hover:bg-white/5">🎥</button>
      </div>
    </div>
  );
}
