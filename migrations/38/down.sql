
-- Remove personalization fields from user_profiles table
ALTER TABLE user_profiles DROP COLUMN personalization_enabled;
ALTER TABLE user_profiles DROP COLUMN location_radius_miles;
ALTER TABLE user_profiles DROP COLUMN home_longitude;
ALTER TABLE user_profiles DROP COLUMN home_latitude;
ALTER TABLE user_profiles DROP COLUMN home_location;
ALTER TABLE user_profiles DROP COLUMN favorite_artists;
