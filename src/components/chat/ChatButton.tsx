'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ChatRoom from './ChatRoom';
import NotificationBadge from '@/components/NotificationBadge';
import { useNotifications } from '@/contexts/NotificationContext';
import { useActivityIndicator } from '@/contexts/ActivityIndicatorContext';
import { MessageCircle } from 'lucide-react';

export default function ChatButton({ chatId, university, label = 'Chat', disabled = false, className = '' }: { chatId: string, university: string, label?: string, disabled?: boolean, className?: string }) {
  const { getUnreadForChat, markChatAsRead } = useNotifications();
  const { markChatAsViewed } = useActivityIndicator();
  const [open, setOpen] = React.useState(false);
  const unreadCount = getUnreadForChat(chatId);

  useEffect(() => {
    if (open) {
      // Mark notifications as read when chat is opened
      markChatAsRead(chatId);
      markChatAsViewed();
    }
  }, [open, chatId, markChatAsRead, markChatAsViewed]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className={`bg-primary text-primary-foreground relative ${className}`.trim()}>
          <MessageCircle className="h-4 w-4 mr-2" />
          {label}
          {unreadCount > 0 && <NotificationBadge count={unreadCount} dot={unreadCount === 1} />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="sr-only">Chat</DialogTitle>
          <DialogDescription className="sr-only">Chat conversation</DialogDescription>
        </DialogHeader>
        <ChatRoom chatId={chatId} university={university} />
      </DialogContent>
    </Dialog>
  );
}
