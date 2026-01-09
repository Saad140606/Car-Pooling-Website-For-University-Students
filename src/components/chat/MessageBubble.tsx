import React from 'react';

export default function MessageBubble({ message, isOwn }: { message: any, isOwn: boolean }) {
  const ts = message.timestamp && message.timestamp.toDate ? message.timestamp.toDate() : (message.timestamp ? new Date(message.timestamp) : null);
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-2 rounded-lg ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-white'}`}>
        {message.type === 'text' && <div className="whitespace-pre-wrap">{message.content}</div>}
        {message.type !== 'text' && message.mediaUrl && (
          <div className="mt-1">
            {message.type === 'image' ? <img src={message.mediaUrl} alt="img" className="max-h-48 rounded" /> : <video src={message.mediaUrl} controls className="max-h-48 rounded" />}
          </div>
        )}
        <div className="text-[0.68rem] text-muted-foreground mt-1 text-right">{ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
      </div>
    </div>
  );
}
