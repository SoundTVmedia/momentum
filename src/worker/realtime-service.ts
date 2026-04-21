/**
 * Helper service for broadcasting real-time updates
 */

export interface RealtimeService {
  broadcastFeedUpdate(clipId: number): Promise<void>;
  broadcastNotification(userId: string, notification: any): Promise<void>;
  broadcastChatMessage(sessionId: number, message: any): Promise<void>;
  broadcastLeaderboardUpdate(data: any): Promise<void>;
  broadcastCommissionUpdate(userId: string, data: any): Promise<void>;
}

export function createRealtimeService(env: Env): RealtimeService {
  const getStub = () => {
    const id = env.REALTIME.idFromName('global');
    return env.REALTIME.get(id);
  };

  const broadcast = async (type: string, data: any, channel: string = 'global') => {
    try {
      const stub = getStub();
      await stub.fetch('https://realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, channel }),
      });
    } catch (error) {
      console.error('Failed to broadcast:', error);
    }
  };

  return {
    async broadcastFeedUpdate(clipId: number) {
      await broadcast('feed_update', { clipId }, 'feed');
    },

    async broadcastNotification(userId: string, notification: any) {
      await broadcast('notification', notification, `user:${userId}`);
    },

    async broadcastChatMessage(sessionId: number, message: any) {
      await broadcast('chat_message', message, `live:${sessionId}`);
    },

    async broadcastLeaderboardUpdate(data: any) {
      await broadcast('leaderboard_update', data, 'leaderboard');
    },

    async broadcastCommissionUpdate(userId: string, data: any) {
      await broadcast('commission_update', data, `user:${userId}`);
    },
  };
}
