
ALTER TABLE clips ADD COLUMN geolocation_latitude REAL;
ALTER TABLE clips ADD COLUMN geolocation_longitude REAL;
ALTER TABLE clips ADD COLUMN geolocation_accuracy_radius REAL;
ALTER TABLE clips ADD COLUMN is_draft BOOLEAN DEFAULT 0;
