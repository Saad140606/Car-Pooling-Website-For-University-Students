"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatBubbleProps {
  message: string;
  sender: "user" | "other";
  avatar?: string;
  senderName?: string;
  timestamp?: string;
  isTyping?: boolean;
  delay?: number;
}

/**
 * Animated chat bubble with smooth entrance, typing indicators, and sender info
 */
export function ChatBubble({
  message,
  sender,
  avatar,
  senderName,
  timestamp,
  isTyping = false,
  delay = 0,
}: ChatBubbleProps) {
  const isUser = sender === "user";

  return (
    <div
      className={cn(
        "animate-scale-up flex gap-2 items-start",
        isUser ? "justify-end" : "justify-start",
        "transition-all duration-300"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {!isUser && avatar && (
        <Avatar className="h-8 w-8 flex-shrink-0 animate-bounce-in">
          <AvatarImage src={avatar} alt={senderName} />
          <AvatarFallback>{senderName?.charAt(0)}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn(isUser ? "order-last" : "")}>
        {!isUser && senderName && (
          <p className="text-xs text-muted-foreground px-3 mb-1">{senderName}</p>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2 max-w-xs break-words",
            "animate-slide-and-fade transition-all duration-300",
            isUser
              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-br-none"
              : "glass-surface text-foreground rounded-bl-none"
          )}
        >
          {isTyping ? (
            <div className="flex gap-1 py-1">
              <div className="animate-typing h-2 w-2 rounded-full bg-current opacity-70" />
              <div
                className="animate-typing h-2 w-2 rounded-full bg-current opacity-70"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="animate-typing h-2 w-2 rounded-full bg-current opacity-70"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          ) : (
            <p className="text-sm">{message}</p>
          )}
        </div>

        {timestamp && (
          <p className={cn(
            "text-xs text-muted-foreground mt-1 px-3",
            isUser ? "text-right" : "text-left"
          )}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Animated chat container with scroll-to-latest and auto-scroll
 */
export function ChatContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 overflow-y-auto scrollbar-custom",
        "p-4 space-y-2",
        className
      )}
    >
      {children}
    </div>
  );
}
