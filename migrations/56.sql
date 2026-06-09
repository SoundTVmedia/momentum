ALTER TABLE user_profiles ADD COLUMN staff_flagged BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN staff_flag_reason TEXT;
ALTER TABLE user_profiles ADD COLUMN staff_flagged_by TEXT;
ALTER TABLE user_profiles ADD COLUMN staff_flagged_at TEXT;
