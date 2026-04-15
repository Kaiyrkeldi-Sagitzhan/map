-- Materialized view for fast dashboard statistics
-- Avoids scanning 1.6M geometry rows on every stats request (~53s → <1ms)
-- Refreshed via: REFRESH MATERIALIZED VIEW CONCURRENTLY geo_object_type_stats;

CREATE MATERIALIZED VIEW IF NOT EXISTS geo_object_type_stats AS
SELECT type,
       COUNT(*)::int AS count,
       ST_AsGeoJSON(ST_Centroid(ST_Extent(geometry)))::text AS centroid_json
FROM geo_objects
WHERE scope = 'global'
GROUP BY type
ORDER BY count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_object_type_stats_type
    ON geo_object_type_stats(type);
