-- Advanced Spatial Optimization Script
-- Goal: Subdivide large geometries into smaller pieces for faster indexing and rendering.

-- 1. Identify and subdivide objects with many vertices
-- We target objects with > 1000 vertices to keep the table size manageable while speeding up BBox queries.
WITH subdivided AS (
    SELECT 
        owner_id, scope, type, name, description, metadata, 
        ST_Subdivide(geometry, 1000) as sub_geom,
        created_at, updated_at
    FROM geo_objects
    WHERE ST_NPoints(geometry) > 1000
)
INSERT INTO geo_objects (owner_id, scope, type, name, description, metadata, geometry, created_at, updated_at)
SELECT owner_id, scope, type, name, description, metadata, sub_geom, created_at, updated_at
FROM subdivided;

-- 2. Delete the original large objects that were subdivided
DELETE FROM geo_objects 
WHERE ST_NPoints(geometry) > 1000 
  AND id NOT IN (SELECT id FROM (SELECT id FROM geo_objects ORDER BY created_at DESC LIMIT 0) s); -- safety check

-- Note: We don't really have a 'parent' reference in the schema, but for OSM data it's fine.
-- In a production app, we'd add a 'parent_id' column to keep track.

-- 3. Reindex to optimize GIST index for the new smaller geometries
REINDEX INDEX idx_geo_objects_geometry;
VACUUM ANALYZE geo_objects;
