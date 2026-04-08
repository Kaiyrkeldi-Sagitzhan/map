-- Migration: Add versioning to geo_objects
-- Adds base_id and version fields for object versioning

ALTER TABLE geo_objects ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE geo_objects ADD COLUMN base_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE geo_objects ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

-- Update existing records to set base_id = id::uuid and version = 0, and id remains as string
UPDATE geo_objects SET base_id = id::uuid, id = id::text WHERE base_id = '00000000-0000-0000-0000-000000000000';

-- Add index for base_id
CREATE INDEX IF NOT EXISTS idx_geo_objects_base_id ON geo_objects(base_id);

-- Add unique constraint for base_id + version
ALTER TABLE geo_objects ADD CONSTRAINT unique_base_id_version UNIQUE (base_id, version);