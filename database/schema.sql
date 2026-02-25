-- Database Schema for Kazakhstan Interactive Map Platform
-- PostgreSQL + PostGIS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Geo objects table with PostGIS geometry
CREATE TABLE IF NOT EXISTS geo_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'private')),
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
-- GIST index for spatial queries
CREATE INDEX IF NOT EXISTS idx_geo_objects_geometry 
    ON geo_objects USING GIST (geometry);

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_geo_objects_metadata 
    ON geo_objects USING GIN (metadata);

-- Index on scope for filtering global vs private objects
CREATE INDEX IF NOT EXISTS idx_geo_objects_scope 
    ON geo_objects (scope);

-- Index on owner_id for ownership queries
CREATE INDEX IF NOT EXISTS idx_geo_objects_owner 
    ON geo_objects (owner_id);

-- Index on type for layer filtering
CREATE INDEX IF NOT EXISTS idx_geo_objects_type 
    ON geo_objects (type);

-- Composite index for efficient object retrieval
CREATE INDEX IF NOT EXISTS idx_geo_objects_scope_owner_type 
    ON geo_objects (scope, owner_id, type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_geo_objects_updated_at 
    BEFORE UPDATE ON geo_objects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - hashed with bcrypt)
-- This is a placeholder - in production, use proper password hashing
INSERT INTO users (id, email, password_hash, role) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@kzmap.edu', '$2b$12$FoI23s3/fDlGnVh9Hjyjau/Q96OIW6bstNkvn3CnnyzvRHwzmr3hq', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kzmap_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kzmap_user;

-- Create view for efficient object retrieval (global + owned private)
CREATE OR REPLACE VIEW accessible_geo_objects AS
SELECT 
    id, owner_id, scope, type, name, description, metadata, 
    ST_AsGeoJSON(geometry) as geometry_json, 
    created_at, updated_at
FROM geo_objects
WHERE scope = 'global' 
   OR owner_id = current_setting('app.current_user_id', true)::uuid
   OR current_setting('app.current_user_role', true) = 'admin';
