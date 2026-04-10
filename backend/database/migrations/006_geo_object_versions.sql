-- Migration: Create geo_object_versions table
-- Stores versioned snapshots of geo objects for history and rollback

CREATE TABLE IF NOT EXISTS geo_object_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geo_object_id UUID NOT NULL REFERENCES geo_objects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE (geo_object_id, version)
);

-- Index for faster queries by geo_object_id
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_geo_object_id
ON geo_object_versions(geo_object_id);

-- Index for faster queries by version
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_version
ON geo_object_versions(version);

-- Index for faster queries by created_at
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_created_at
ON geo_object_versions(created_at DESC);

-- GIST index for spatial queries on versions
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_geometry
ON geo_object_versions USING GIST (geometry);

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_geo_object_versions_metadata
ON geo_object_versions USING GIN (metadata);