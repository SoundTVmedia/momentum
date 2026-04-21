import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@getmocha/users-service/react';

interface ChatMessage {
  id: number;
  live_session_id: number;
  mocha_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_display_name: string | null;
  user_avatar: string | null;
}

export function useLiveChat(sessionId: number | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async (since?: string) => {
    if (!sessionId) return;

    try {
      const params = new URLSearchParams();
      if (since) params.append('since', since);

      const response = await fetch(`/api/live/${sessionId}/chat?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat messages');
      }

      const data = await response.json();
      
      if (since) {
        // Append new messages
        setMessages((prev) => [...prev, ...(data.messages || [])]);
      } else {
        // Replace all messages
        setMessages(data.messages || []);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const postMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!sessionId || !user) {
        return false;
      }

      try {
        const response = await fetch(`/api/live/${sessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error('Failed to post message');
        }

        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        return true;
      } catch (err) {
        console.error('Failed to post message:', err);
        return false;
      }
    },
    [sessionId, user]
  );

  // Initial fetch
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      fetchMessages();
    }
  }, [sessionId, fetchMessages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const interval = setInterval(() => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        fetchMessages(lastMessage.created_at);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, messages, fetchMessages]);

  return {
    messages,
    loading,
    error,
    postMessage,
    refresh: () => fetchMessages(),
  };
}
