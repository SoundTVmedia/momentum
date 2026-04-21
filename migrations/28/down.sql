
DROP INDEX IF EXISTS idx_live_poll_votes_poll;
DROP INDEX IF EXISTS idx_live_polls_session;
DROP INDEX IF EXISTS idx_user_badges_user;
DROP INDEX IF EXISTS idx_point_transactions_user;
DROP INDEX IF EXISTS idx_user_points_user;

DROP TABLE live_poll_votes;
DROP TABLE live_polls;
DROP TABLE user_badges;
DROP TABLE badges;
DROP TABLE point_transactions;
DROP TABLE user_points;
