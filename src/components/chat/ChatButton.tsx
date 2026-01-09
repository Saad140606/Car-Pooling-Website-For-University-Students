import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChatRoom from './ChatRoom';

export default function ChatButton({ chatId, university, label = 'Chat', disabled = false }: { chatId: string, university: string, label?: string, disabled?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="bg-primary text-primary-foreground">{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="sr-only">Chat</DialogTitle>
        </DialogHeader>
        <ChatRoom chatId={chatId} university={university} />
      </DialogContent>
    </Dialog>
  );
}
