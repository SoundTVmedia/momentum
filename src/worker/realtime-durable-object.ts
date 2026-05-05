/**
 * Cloudflare Durable Object for real-time features
 * Handles WebSocket connections for live updates, chat, notifications, etc.
 */

import { DurableObject } from "cloudflare:workers";

interface Session {
  webSocket: WebSocket;
  userId: string | null;
  sessionId: string;
  subscriptions: Set<string>;
}

interface BroadcastMessage {
  type: 'feed_update' | 'notification' | 'chat_message' | 'leaderboard_update' | 'commission_update';
  data: any;
  channel?: string;
}

export class RealtimeDurableObject extends DurableObject {
  private sessions: Map<WebSocket, Session>;
  private channels: Map<string, Set<WebSocket>>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();
    this.channels = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle broadcast endpoint
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    // Handle channel info
    if (url.pathname === '/channels' && request.method === 'GET') {
      return this.handleChannelInfo();
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Parse auth from query params or headers
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const sessionId = url.searchParams.get('session_id') || crypto.randomUUID();

    // Create session
    const session: Session = {
      webSocket: server,
      userId: userId || null,
      sessionId,
      subscriptions: new Set(),
    };

    this.sessions.set(server, session);

    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data);
    });

    server.addEventListener('close', () => {
      this.handleClose(server);
    });

    server.addEventListener('error', () => {
      this.handleClose(server);
    });

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString(),
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleMessage(ws: WebSocket, data: string | ArrayBuffer) {
    try {
      const session = this.sessions.get(ws);
      if (!session) return;

      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, session, message.channel);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(ws, session, message.channel);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  }

  private handleSubscribe(ws: WebSocket, session: Session, channel: string) {
    if (!channel) {
      ws.send(JSON.stringify({ type: 'error', message: 'Channel name required' }));
      return;
    }

    // Add to session subscriptions
    session.subscriptions.add(channel);

    // Add to channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(ws);

    ws.send(JSON.stringify({
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString(),
    }));
  }

  private handleUnsubscribe(ws: WebSocket, session: Session, channel: string) {
    if (!channel) return;

    session.subscriptions.delete(channel);

    const channelSessions = this.channels.get(channel);
    if (channelSessions) {
      channelSessions.delete(ws);
      if (channelSessions.size === 0) {
        this.channels.delete(channel);
      }
    }

    ws.send(JSON.stringify({
      type: 'unsubscribed',
      channel,
      timestamp: new Date().toISOString(),
    }));
  }

  private handleClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Remove from all channels
    for (const channel of session.subscriptions) {
      const channelSessions = this.channels.get(channel);
      if (channelSessions) {
        channelSessions.delete(ws);
        if (channelSessions.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    // Remove session
    this.sessions.delete(ws);
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const message: BroadcastMessage = await request.json();

      if (!message.type || !message.data) {
        return new Response('Invalid broadcast message', { status: 400 });
      }

      const channel = message.channel || 'global';
      const channelSessions = this.channels.get(channel);

      if (!channelSessions || channelSessions.size === 0) {
        return new Response(JSON.stringify({ delivered: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload = JSON.stringify({
        type: message.type,
        data: message.data,
        channel,
        timestamp: new Date().toISOString(),
      });

      let delivered = 0;
      for (const ws of channelSessions) {
        try {
          ws.send(payload);
          delivered++;
        } catch (error) {
          console.error('Error sending to websocket:', error);
          this.handleClose(ws);
        }
      }

      return new Response(JSON.stringify({ delivered }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling broadcast:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async handleChannelInfo(): Promise<Response> {
    const info = {
      totalSessions: this.sessions.size,
      channels: Array.from(this.channels.entries()).map(([name, sessions]) => ({
        name,
        subscribers: sessions.size,
      })),
    };

    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
