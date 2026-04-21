import { useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { useComments } from '@/react-app/hooks/useComments';
import { CommentSkeleton } from './LoadingSkeleton';

interface CommentSectionProps {
  clipId: number;
}

export default function CommentSection({ clipId }: CommentSectionProps) {
  const { user } = useAuth();
  const { comments, loading, postComment } = useComments(clipId);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    const success = await postComment(newComment, replyTo || undefined);
    
    if (success) {
      setNewComment('');
      setReplyTo(null);
    }
    
    setSubmitting(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <MessageCircle className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-white">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Input */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-gray-400">Replying to comment...</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex space-x-2">
            <img
              src={user.google_user_data.picture || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
              alt="Your avatar"
              className="w-10 h-10 rounded-full border-2 border-cyan-500/40"
            />
            <div className="flex-1 flex space-x-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Join the conversation..."
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 tap-feedback"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
          <p className="text-gray-400">Sign in to join the chat</p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4 animate-fade-in">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment, index) => (
            <div 
              key={comment.id} 
              className="flex space-x-3 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <img
                src={comment.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                alt={comment.user_display_name || 'User'}
                className="w-10 h-10 rounded-full border-2 border-cyan-500/40"
              />
              <div className="flex-1">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      {comment.user_display_name || 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{comment.content}</p>
                </div>
                {user && (
                  <button
                    onClick={() => setReplyTo(comment.id)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 ml-3 transition-colors tap-feedback"
                  >
                    Reply
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
