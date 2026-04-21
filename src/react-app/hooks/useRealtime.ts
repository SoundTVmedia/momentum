import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@getmocha/users-service/react';

interface RealtimeMessage {
  type: string;
  data: any;
  channel?: string;
  timestamp: string;
}

interface UseRealtimeOptions {
  channels?: string[];
  onMessage?: (message: RealtimeMessage) => void;
  autoReconnect?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { user } = useAuth();
  const { channels = [], onMessage, autoReconnect = true } = options;
  
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    try {
      // Clear any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const params = new URLSearchParams();
      
      if (user) {
        params.append('user_id', user.id);
      }
      params.append('session_id', crypto.randomUUID());

      const wsUrl = `${protocol}//${host}/realtime?${params}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to channels
        channels.forEach((channel) => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });
      });

      ws.addEventListener('message', (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          
          if (message.type === 'connected' || message.type === 'pong') {
            // System messages, ignore
            return;
          }

          if (onMessage) {
            onMessage(message);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      });

      ws.addEventListener('close', () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (autoReconnect) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect... (attempt ${reconnectAttemptsRef.current})`);
            connect();
          }, delay);
        }
      });

      ws.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
      });

    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError('Failed to connect');
    }
  }, [user, channels, onMessage, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }, [connected]);

  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }, [connected]);

  const ping = useCallback(() => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, [connected]);

  useEffect(() => {
    connect();

    // Ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, ping]);

  return {
    connected,
    error,
    subscribe,
    unsubscribe,
    reconnect: connect,
    disconnect,
  };
}
