'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { MessageCircle, Check, CheckCheck, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

export default function ContactMessagesSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    setError(null);

    // Use real-time listener for contact messages
    // FIXED: Collection name is 'contact_messages' (with underscore) per Firestore rules
    const messagesCol = safeCollection(firestore, 'contact_messages');
    
    const unsubscribe = onSnapshot(
      messagesCol,
      (snapshot) => {
        console.log('[ContactMessages] Snapshot received:', snapshot.size, 'documents');
        
        const messagesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Normalize field names (status/isRead compatibility)
          isRead: doc.data().isRead ?? doc.data().status === 'resolved',
        }));

        setMessages(messagesList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[ContactMessages] Failed to fetch messages:', err);
        setError(`Failed to load messages: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  const handleMarkAsRead = async (messageId: string) => {
    if (!firestore) return;
    try {
      // FIXED: Use correct collection name
      const msgRef = doc(firestore, 'contact_messages', messageId);
      await updateDoc(msgRef, { isRead: true, status: 'resolved' });
      // State will auto-update via onSnapshot listener
    } catch (err: any) {
      console.error('[ContactMessages] Failed to mark as read:', err);
      alert(`Failed to mark as read: ${err.message}`);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filterStatus === 'unread') return !msg.isRead;
    if (filterStatus === 'read') return msg.isRead;
    return true;
  });

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'unread', 'read'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-all capitalize flex items-center gap-2 ${
              filterStatus === status
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {status === 'unread' && '◉'}
            {status}
            {status === 'unread' && `(${messages.filter(m => !m.isRead).length})`}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="space-y-3 animate-in fade-in">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800/30 rounded-xl animate-pulse" />
          ))
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No messages found</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl border backdrop-blur-md transition-all cursor-pointer ${
                msg.isRead
                  ? 'bg-slate-800/30 border-slate-700/30'
                  : 'bg-gradient-to-r from-blue-900/30 to-slate-800/30 border-blue-700/50 shadow-lg shadow-blue-900/20'
              }`}
            >
              {/* Message Header */}
              <div
                onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                className="p-4 flex items-start justify-between hover:bg-slate-800/20 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className={`mt-1 ${msg.isRead ? 'text-slate-400' : 'text-blue-400'}`}>
                    {msg.isRead ? <CheckCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{msg.senderName || 'Unknown Sender'}</p>
                      <p className="text-xs text-slate-400">{msg.senderEmail}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{msg.subject}</p>
                    <p className="text-sm text-slate-300 mt-2 line-clamp-1">{msg.message}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex-shrink-0 ml-2">
                  {msg.createdAt?.toDate?.()?.toLocaleDateString?.()}
                </p>
              </div>

              {/* Expanded Message */}
              {expandedId === msg.id && (
                <div className="border-t border-slate-700/30 p-4 space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Full Message</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{msg.message}</p>
                  </div>
                  
                  {msg.attachmentUrl && (
                    <div>
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        View Attachment
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-700/30">
                    {!msg.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(msg.id)}
                        className="flex-1 px-3 py-2 bg-blue-900/50 hover:bg-blue-900/70 text-blue-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
