import { Radio, Users, Volume2, Heart, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import { useLiveSession } from '@/react-app/hooks/useLiveSession';
import { useLiveChat } from '@/react-app/hooks/useLiveChat';
import { useClipLike } from '@/react-app/hooks/useClipLike';
import { useLiveSchedule } from '@/react-app/hooks/useLiveSchedule';
import LivePoll from '@/react-app/components/LivePoll';
import { useLivePoll } from '@/react-app/hooks/useLivePoll';
import LiveSchedulePreview from '@/react-app/components/LiveSchedulePreview';
import { artistPath } from '@/shared/app-paths';

interface LiveBroadcastProps {
  layoutMode?: 'full' | 'compact';
}

export default function LiveBroadcast({ layoutMode = 'full' }: LiveBroadcastProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, currentClip, viewerCount, loading } = useLiveSession();
  const { messages, postMessage } = useLiveChat(session?.id || null);
  const { schedule } = useLiveSchedule(session?.id || null);
  const { toggleLike, isLiked } = useClipLike();
  const { activePoll, refreshPoll } = useLivePoll(session?.id || null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isLive = session?.status === 'live';
  
  // Get next few clips from schedule
  const upcomingClips = schedule
    .filter(item => !item.played_at)
    .slice(0, 3);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const success = await postMessage(newMessage);
    
    if (success) {
      setNewMessage('');
    }
    
    setSending(false);
  };

  const handleLikeCurrentClip = async () => {
    if (currentClip) {
      await toggleLike(currentClip.id, currentClip.likes_count);
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
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return layoutMode === 'compact' ? null : (
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-black via-purple-900/30 to-black">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 text-center">
          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-cyan-400 animate-spin mx-auto" />
        </div>
      </section>
    );
  }

  // Compact mode for when not live
  if (!isLive && layoutMode === 'compact') {
    return (
      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-lg border border-cyan-500/40 rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
        {/* Subtle background glow */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute left-0 w-32 h-32 bg-cyan-500/30 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
          {/* Status */}
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <div className="relative">
              <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            
            <div className="text-center sm:text-left">
              <h3 className="text-base sm:text-lg font-bold text-white">
                MOMENTUM <span className="text-cyan-400">LIVE</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-300">
                {session ? (
                  <>Next show: {new Date(session.start_time).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}</>
                ) : (
                  'Tonight 8:00 PM - 12:00 AM EST'
                )}
              </p>
            </div>
          </div>
          
          {/* CTA */}
          <button className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold text-white text-sm sm:text-base hover:scale-105 transition-all shadow-lg shadow-cyan-500/30 whitespace-nowrap">
            Set Reminder
          </button>
        </div>
      </div>
    );
  }

  // Full section mode when not live
  if (!isLive) {
    return (
      <section className="py-3 sm:py-4 bg-gradient-to-r from-black via-purple-900/30 to-black">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-lg border border-cyan-500/40 rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
            {/* Subtle background glow */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute left-0 w-32 h-32 bg-cyan-500/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
            
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              {/* Left side - Status */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                </div>
                
                <div className="text-center sm:text-left">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    MOMENTUM <span className="text-cyan-400">LIVE</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300">
                    {session ? (
                      <>Next show: {new Date(session.start_time).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}</>
                    ) : (
                      'Tonight 8:00 PM - 12:00 AM EST'
                    )}
                  </p>
                </div>
              </div>
              
              {/* Right side - CTA */}
              <button className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold text-white text-sm sm:text-base hover:scale-105 transition-all shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Full live player
  return (
    <section className="py-8 sm:py-12 md:py-16 lg:py-20 bg-gradient-to-r from-black via-red-900/30 to-black">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 md:space-x-3 mb-2 sm:mb-3 md:mb-4">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white">
              MOMENTUM <span className="text-red-400">LIVE</span>
            </h2>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 px-4">Experience live concert magic from around the world, streaming now</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {/* Main Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg sm:rounded-xl overflow-hidden border border-red-500/30">
              <div className="aspect-video bg-gradient-to-br from-purple-900/50 to-black relative">
                {currentClip ? (
                  <>
                    <video
                      src={currentClip.video_url}
                      poster={currentClip.thumbnail_url || undefined}
                      autoPlay
                      controls
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 flex items-center space-x-1.5 sm:space-x-2 bg-black/60 backdrop-blur-lg rounded-full px-2 py-1 sm:px-2.5 sm:py-1 md:px-3">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-400 font-medium text-xs sm:text-sm">LIVE</span>
                      <span className="text-white/60 text-xs sm:text-sm">•</span>
                      <div className="flex items-center space-x-0.5 sm:space-x-1 text-white/80 text-xs sm:text-sm">
                        <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden xs:inline">{viewerCount.toLocaleString()}</span>
                        <span className="xs:hidden">{viewerCount > 999 ? `${Math.floor(viewerCount/1000)}k` : viewerCount}</span>
                      </div>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 md:bottom-4 md:left-4 md:right-4">
                      <div className="bg-black/60 backdrop-blur-lg rounded-lg p-2.5 sm:p-3 md:p-4">
                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            {currentClip.artist_name && (
                              <button
                                onClick={() => navigate(artistPath(currentClip.artist_name!))}
                                className="text-white font-bold hover:text-cyan-400 transition-colors text-xs sm:text-sm md:text-base truncate block"
                              >
                                {currentClip.artist_name}
                              </button>
                            )}
                            {currentClip.venue_name && (
                              <div className="text-cyan-300 text-xs sm:text-sm truncate">{currentClip.venue_name}</div>
                            )}
                            {currentClip.user_display_name && (
                              <div className="text-gray-400 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
                                Uploaded by {currentClip.user_display_name}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                            <button 
                              onClick={handleLikeCurrentClip}
                              className={`transition-colors p-1 sm:p-0 ${
                                isLiked(currentClip.id) 
                                  ? 'text-red-400' 
                                  : 'text-white hover:text-red-400'
                              }`}
                            >
                              <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked(currentClip.id) ? 'fill-current' : ''}`} />
                            </button>
                            <button className="text-white hover:text-cyan-400 transition-colors p-1 sm:p-0 hidden sm:block">
                              <Volume2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-cyan-400 animate-spin mx-auto mb-2 sm:mb-3 md:mb-4" />
                      <p className="text-white text-sm sm:text-base">Loading next clip...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <button 
                  onClick={async () => {
                    const link = `${window.location.origin}/?live=true`;
                    try {
                      if (navigator.share) {
                        await navigator.share({
                          title: 'Watch MOMENTUM Live!',
                          text: 'Join me watching live concert moments on MOMENTUM',
                          url: link
                        });
                      } else {
                        await navigator.clipboard.writeText(link);
                        alert('Link copied! Share it with friends.');
                      }
                    } catch (err) {
                      console.error('Share failed:', err);
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  Share Stream
                </button>
                <button className="flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform text-xs sm:text-sm whitespace-nowrap">
                  Follow Show
                </button>
              </div>
              <div className="text-gray-400 text-xs sm:text-sm text-center sm:text-right truncate">
                {session.title || 'MOMENTUM Live'}
              </div>
            </div>

            {/* Enhanced Up Next Section */}
            {upcomingClips.length > 0 && (
              <div className="mt-4 sm:mt-5 md:mt-6">
                <LiveSchedulePreview items={upcomingClips} showShareOptions={true} />
              </div>
            )}
          </div>

          {/* Live Chat */}
          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-lg sm:rounded-xl flex flex-col h-[400px] sm:h-[450px] lg:h-auto">
            <div className="p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
                <h3 className="font-bold text-white text-sm sm:text-base">Live Chat</h3>
                <span className="text-cyan-400 text-xs sm:text-sm">({viewerCount.toLocaleString()})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 min-h-0">
              {activePoll && (
                <LivePoll 
                  poll={activePoll} 
                  onVote={refreshPoll}
                />
              )}
              
              {messages.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-xs sm:text-sm px-4">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="text-xs sm:text-sm break-words">
                    <div className="flex items-start space-x-1.5 sm:space-x-2">
                      <img
                        src={message.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=24&h=24&fit=crop&crop=face'}
                        alt={message.user_display_name || 'User'}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-cyan-400 font-medium break-words">
                          {message.user_display_name || 'Anonymous'}:
                        </span>
                        <span className="text-white ml-1.5 sm:ml-2 break-words">{message.content}</span>
                        <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                          {formatTimestamp(message.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-white/10 flex-shrink-0">
              {user ? (
                <form onSubmit={handleSendMessage} className="flex space-x-1.5 sm:space-x-2">
                  <input 
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Join the conversation..."
                    className="flex-1 px-2.5 py-2 sm:px-3 sm:py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-xs sm:text-sm"
                    disabled={sending}
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-2">
                  <button
                    onClick={() => navigate('/')}
                    className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm"
                  >
                    Sign in to chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
