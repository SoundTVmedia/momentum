import { Bell, Heart, MessageCircle, UserPlus, X, Check, Star, Award, Video, Radio, Shield, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '@/react-app/hooks/useNotifications';
import { useNavigate } from 'react-router';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { icon: <Heart className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-red-500/20 text-red-400', ringColor: 'ring-red-500/30' };
      case 'comment':
        return { icon: <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-blue-500/20 text-blue-400', ringColor: 'ring-blue-500/30' };
      case 'follow':
        return { icon: <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-green-500/20 text-green-400', ringColor: 'ring-green-500/30' };
      case 'verification':
        return { icon: <Shield className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-blue-500/20 text-blue-400', ringColor: 'ring-blue-500/30' };
      case 'trending':
        return { icon: <Star className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-orange-500/20 text-orange-400', ringColor: 'ring-orange-500/30' };
      case 'achievement':
        return { icon: <Award className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-purple-500/20 text-purple-400', ringColor: 'ring-purple-500/30' };
      case 'clip':
        return { icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-cyan-500/20 text-cyan-400', ringColor: 'ring-cyan-500/30' };
      case 'live':
        return { icon: <Radio className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-red-500/20 text-red-400', ringColor: 'ring-red-500/30' };
      default:
        return { icon: <Bell className="w-4 h-4 sm:w-5 sm:h-5" />, color: 'bg-cyan-500/20 text-cyan-400', ringColor: 'ring-cyan-500/30' };
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

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    if (notification.related_clip_id) {
      navigate('/');
      onClose();
    } else if (notification.related_user_id) {
      // Navigate to user profile when we have that page
      onClose();
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => n.is_read === 0)
    : notifications;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-black/95 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden z-50 shadow-xl shadow-cyan-500/10">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center space-x-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-cyan-400" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-base sm:text-lg">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="p-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
              title="Mark all as read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 sm:max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p className="text-xs text-gray-500">
              {filter === 'unread' ? 'You have no unread notifications' : 'New notifications will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map((notification) => {
              const iconData = getIcon(notification.type);
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-3 sm:p-4 hover:bg-white/5 transition-all text-left group relative ${
                    notification.is_read === 0 ? 'bg-gradient-to-r from-cyan-500/5 to-transparent' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar with icon overlay */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={notification.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                        alt={notification.user_display_name || 'User'}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/10 group-hover:border-cyan-500/40 transition-colors"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 ${iconData.color} rounded-full flex items-center justify-center ring-2 ${iconData.ringColor} ring-offset-1 ring-offset-black`}>
                        {iconData.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm sm:text-base leading-snug">
                        <span className="font-semibold">
                          {notification.user_display_name || 'Someone'}
                        </span>{' '}
                        <span className="text-gray-300">{notification.content}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                        <span>{formatTimestamp(notification.created_at)}</span>
                        {notification.is_read === 0 && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-medium">
                            NEW
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {notification.is_read === 0 && (
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
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
