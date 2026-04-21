
ALTER TABLE user_profiles DROP COLUMN is_moderator;
ALTER TABLE user_profiles DROP COLUMN is_admin;

DROP INDEX idx_chat_bans_user;
DROP INDEX idx_chat_bans_session;
DROP TABLE live_chat_bans;

ALTER TABLE live_chat_messages DROP COLUMN deleted_at;
ALTER TABLE live_chat_messages DROP COLUMN deleted_by;
ALTER TABLE live_chat_messages DROP COLUMN is_deleted;
