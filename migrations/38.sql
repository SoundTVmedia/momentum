
-- Add personalization fields to user_profiles table
ALTER TABLE user_profiles ADD COLUMN favorite_artists TEXT;
ALTER TABLE user_profiles ADD COLUMN home_location TEXT;
ALTER TABLE user_profiles ADD COLUMN home_latitude REAL;
ALTER TABLE user_profiles ADD COLUMN home_longitude REAL;
ALTER TABLE user_profiles ADD COLUMN location_radius_miles INTEGER DEFAULT 50;
ALTER TABLE user_profiles ADD COLUMN personalization_enabled BOOLEAN DEFAULT 1;
