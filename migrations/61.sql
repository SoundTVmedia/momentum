-- Preserve venue timezone on show marks for in-progress ("I'm there") detection.
ALTER TABLE user_show_marks ADD COLUMN venue_timezone TEXT;
