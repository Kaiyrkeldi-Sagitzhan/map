-- Migration 005: Backfill area metadata for polygonal geometries

UPDATE geo_objects
SET metadata =
    CASE
        WHEN GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON') THEN
            COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'area_m2', ROUND(ST_Area(geometry::geography)::numeric, 2),
                'area_km2', ROUND((ST_Area(geometry::geography) / 1000000.0)::numeric, 6)
            )
        ELSE
            COALESCE(metadata, '{}'::jsonb) - 'area_m2' - 'area_km2'
    END
WHERE geometry IS NOT NULL;
