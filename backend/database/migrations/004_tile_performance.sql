-- Functional GIST index for MVT tile generation
-- Matches ST_Transform(geometry, 3857) used in GetTileMVT query
-- Eliminates per-row coordinate transformation during spatial intersection check
CREATE INDEX IF NOT EXISTS idx_geo_objects_geometry_3857
    ON geo_objects USING GIST (ST_Transform(geometry, 3857));

ANALYZE geo_objects;
