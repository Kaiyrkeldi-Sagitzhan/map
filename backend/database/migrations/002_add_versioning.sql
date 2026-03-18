-- Migration: Add versioning support for geo objects
-- Created: 2024-01-15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Add columns to geo_objects for versioning support
ALTER TABLE geo_objects 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES geo_objects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_version BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- Create index for querying versions by parent_id
CREATE INDEX IF NOT EXISTS idx_geo_objects_parent_id 
    ON geo_objects (parent_id);

-- Create index for filtering versions
CREATE INDEX IF NOT EXISTS idx_geo_objects_is_version 
    ON geo_objects (is_version) WHERE is_version = true;

-- Create index for version_number ordering
CREATE INDEX IF NOT EXISTS idx_geo_objects_parent_version 
    ON geo_objects (parent_id, version_number DESC);

-- Create geo_object_versions table for storing version snapshots
CREATE TABLE IF NOT EXISTS geo_object_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_id UUID NOT NULL REFERENCES geo_objects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}',
    change_description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_object_version UNIQUE (object_id, version_number)
);

-- Index for querying versions by object_id
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_object_id 
    ON geo_object_versions (object_id);

-- Index for ordering versions by number
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_number 
    ON geo_object_versions (object_id, version_number DESC);

-- Index for created_by to show author of version
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_created_by 
    ON geo_object_versions (created_by);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kzmap_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kzmap_user;

-- Function to get next version number for an object
CREATE OR REPLACE FUNCTION get_next_version_number(p_object_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM geo_object_versions
    WHERE object_id = p_object_id;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create version snapshot before update
CREATE OR REPLACE FUNCTION create_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    snapshot JSONB;
BEGIN
    -- Skip if this is already a version or if update is from version creation
    IF NEW.is_version = true OR NEW.parent_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Skip if no significant changes (optional: can be customized)
    IF OLD.name = NEW.name AND 
       COALESCE(OLD.description, '') = COALESCE(NEW.description, '') AND
       ST_AsGeoJSON(OLD.geometry) = ST_AsGeoJSON(NEW.geometry) THEN
        RETURN NEW;
    END IF;
    
    -- Get next version number
    next_version := get_next_version_number(NEW.id);
    
    -- Create snapshot of current state
    snapshot := jsonb_build_object(
        'id', OLD.id,
        'owner_id', OLD.owner_id,
        'scope', OLD.scope,
        'type', OLD.type,
        'name', OLD.name,
        'description', OLD.description,
        'metadata', OLD.metadata,
        'geometry', ST_AsGeoJSON(OLD.geometry),
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
    );
    
    -- Insert into versions table
    INSERT INTO geo_object_versions (object_id, version_number, snapshot, created_by, created_at)
    VALUES (NEW.id, next_version, snapshot, NEW.owner_id, OLD.updated_at);
    
    -- Update version number on the object
    NEW.version_number := next_version;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create version before update
DROP TRIGGER IF EXISTS create_version_on_update ON geo_objects;
CREATE TRIGGER create_version_on_update
    BEFORE UPDATE ON geo_objects
    FOR EACH ROW
    EXECUTE FUNCTION create_version_snapshot();

-- View to get all versions (including current state) for an object
CREATE OR REPLACE VIEW object_version_history AS
SELECT 
    go.id,
    go.parent_id,
    go.is_version,
    go.version_number,
    go.name,
    go.type,
    go.scope,
    go.created_at,
    go.updated_at,
    gov.change_description,
    gov.created_by
FROM geo_objects go
LEFT JOIN geo_object_versions gov ON gov.object_id = go.id AND go.is_version = false
WHERE go.parent_id IS NOT NULL
   OR go.is_version = false
ORDER BY go.id, go.version_number DESC;
