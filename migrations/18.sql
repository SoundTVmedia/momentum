
-- Add missing performance indexes

-- Clips table indexes (add only missing ones)
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_clips_trending ON clips(is_trending_score DESC, created_at DESC);

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(mocha_user_id);

-- Clip likes table indexes  
CREATE INDEX IF NOT EXISTS idx_clip_likes_user_id ON clip_likes(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_clip_likes_created ON clip_likes(created_at DESC);

-- Saved clips table indexes
CREATE INDEX IF NOT EXISTS idx_saved_clips_user_id ON saved_clips(mocha_user_id, created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(mocha_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_verified ON user_profiles(is_verified);
