-- Migration 001: Initial schema
-- Run this after database is created

-- Check if migrations table exists, if not create it
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Record this migration
INSERT INTO schema_migrations (version, description) 
VALUES ('001', 'Initial schema with users and geo_objects tables')
ON CONFLICT (version) DO NOTHING;

-- Verify PostGIS is properly installed
SELECT postgis_version();
SELECT postgis_full_version();

-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'geo_objects', 'schema_migrations');
