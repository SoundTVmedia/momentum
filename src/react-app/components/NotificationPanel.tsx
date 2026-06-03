import { Bell, Heart, MessageCircle, UserPlus, X, Check, Star, Award, Video, Radio, Shield, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { Notification } from '@/react-app/hooks/useNotifications';
import { useNotificationsContext } from '@/react-app/contexts/NotificationsContext';
import { useNavigate } from 'react-router';
import UserAvatar from '@/react-app/components/UserAvatar';

interface NotificationPanelProps {
  onClose: () => void;
  /** `mobile` = sheet above bottom nav; default = header dropdown anchor */
  variant?: 'dropdown' | 'mobile';
}

export default function NotificationPanel({
  onClose,
  variant = 'dropdown',
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const {
    unreadNotifications,
    readNotifications,
    unreadCount,
    readCount,
    markAsRead,
    markAllAsRead,
    loading,
    error,
    isNotificationUnread,
  } = useNotificationsContext();
  const [filter, setFilter] = useState<'unread' | 'read'>('unread');

  const displayedNotifications =
    filter === 'unread' ? unreadNotifications : readNotifications;
  const displayedCount = displayedNotifications.length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { icon: <Heart className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-red-500/20 text-red-400', ringColor: 'ring-red-500/30' };
      case 'comment':
        return { icon: <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-flare/20 text-momentum-flare', ringColor: 'ring-momentum-flare/30' };
      case 'follow':
        return { icon: <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-green-500/20 text-green-400', ringColor: 'ring-green-500/30' };
      case 'verification':
        return { icon: <Shield className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-flare/20 text-momentum-flare', ringColor: 'ring-momentum-flare/30' };
      case 'trending':
        return { icon: <Star className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-ember/15 text-momentum-ember', ringColor: 'ring-momentum-ember/30' };
      case 'achievement':
        return { icon: <Award className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-rose/20 text-momentum-rose', ringColor: 'ring-momentum-rose/30' };
      case 'clip':
        return { icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-ember/20 text-momentum-flare', ringColor: 'ring-momentum-ember/30' };
      case 'live':
        return { icon: <Radio className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-red-500/20 text-red-400', ringColor: 'ring-red-500/30' };
      default:
        return { icon: <Bell className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-momentum-ember/20 text-momentum-flare', ringColor: 'ring-momentum-ember/30' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);

    const clipId = notification.related_clip_id;
    if (clipId != null && Number(clipId) > 0) {
      onClose();
      navigate({ pathname: '/', search: `?clip=${clipId}` });
      return;
    }

    if (notification.type === 'follow' && notification.related_user_id) {
      onClose();
      navigate(`/users/${notification.related_user_id}`);
      return;
    }

    if (notification.related_user_id) {
      onClose();
      navigate(`/users/${notification.related_user_id}`);
    }
  };

  const panelClass =
    variant === 'mobile'
      ? 'w-full glass-dropdown rounded-xl overflow-hidden shadow-xl shadow-momentum-ember/15'
      : 'absolute top-full right-0 mt-2 w-80 sm:w-96 glass-dropdown rounded-xl overflow-hidden z-50 shadow-xl shadow-momentum-ember/15';

  return (
    <div className={panelClass} role="dialog" aria-label="Notifications">
      <div className="p-3 sm:p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center space-x-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-momentum-flare" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-base sm:text-lg">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-red-600 to-momentum-flare rounded-full text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-momentum-ember/20 text-momentum-flare border border-momentum-ember/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('read')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'read'
                ? 'bg-momentum-ember/20 text-momentum-flare border border-momentum-ember/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Read ({readCount})
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="p-1.5 text-momentum-flare hover:text-momentum-flare/90 transition-colors"
              title="Mark all as read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 sm:max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">{error}</div>
        ) : displayedCount === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">
              {filter === 'unread' ? 'All caught up!' : 'No read notifications yet'}
            </p>
            <p className="text-xs text-gray-500">
              {filter === 'unread'
                ? 'New likes, comments, follows, and posts from people you follow appear here.'
                : 'Notifications you open will move here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayedNotifications.map((notification) => {
              const iconData = getIcon(notification.type);
              const unread = isNotificationUnread(notification.is_read);
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={`w-full p-3 sm:p-4 hover:bg-white/5 transition-all text-left group relative ${
                    unread ? 'bg-gradient-to-r from-momentum-ember/8 to-transparent' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="relative flex-shrink-0">
                      <UserAvatar
                        imageUrl={notification.user_avatar}
                        displayName={notification.user_display_name}
                        seed={notification.related_user_id ?? notification.mocha_user_id}
                        alt={notification.user_display_name || 'User'}
                        sizeClass="w-10 h-10 sm:w-12 sm:h-12"
                        letterClassName="text-sm sm:text-base font-semibold"
                        className="border-2 border-white/10 group-hover:border-momentum-ember/40 transition-colors"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 ${iconData.color} rounded-full flex items-center justify-center ring-2 ${iconData.ringColor} ring-offset-1 ring-offset-black`}
                      >
                        {iconData.icon}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm sm:text-base leading-snug">
                        <span className="font-semibold">
                          {notification.user_display_name || 'Someone'}
                        </span>{' '}
                        <span className="text-gray-300">{notification.content}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                        <span>{formatTimestamp(notification.created_at)}</span>
                        {unread && (
                          <span className="px-1.5 py-0.5 bg-momentum-ember/20 text-momentum-flare rounded text-[10px] font-medium">
                            NEW
                          </span>
                        )}
                      </p>
                    </div>

                    {unread && (
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-2 h-2 bg-momentum-flare rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
