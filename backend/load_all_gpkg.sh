#!/bin/bash
# PRO GeoPackage to PostGIS Loader
# Capturing EVERY SINGLE ATTRIBUTE for advanced cartography

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-kzmap}"
DB_USER="${DB_USER:-kzmap_user}"
DB_PASS="${DB_PASS:-kzmap_password}"
GPKG_FILE="gpkg_data/kazakhstan.gpkg"
OWNER_ID="00000000-0000-0000-0000-000000000001" # Admin user

export PGPASSWORD=$DB_PASS

echo "================================================="
echo "   ULTIMATE GeoPackage Attribute Importer"
echo "================================================="

echo "Cleaning up existing data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE geo_objects CASCADE;"

load_layer_pro() {
    local layer_name=$1
    local internal_type=$2
    
    echo "-------------------------------------------------"
    echo "Importing layer: $layer_name (with all attributes)"
    
    # Load into temp table with ALL columns (*)
    ogr2ogr -f PostgreSQL "PG:host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME password=$DB_PASS" \
      $GPKG_FILE $layer_name \
      -nln tmp_import -overwrite \
      -t_srs EPSG:4326 \
      -nlt PROMOTE_TO_MULTI \
      -lco OVERWRITE=YES

    echo "Transferring data + generating metadata JSON..."
    # We use to_jsonb(tmp_import.*) and subtract 'geom' and 'fid' to keep only attributes
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
      INSERT INTO geo_objects (owner_id, scope, type, name, description, metadata, geometry)
      SELECT 
        '$OWNER_ID',
        'global',
        CASE 
            WHEN fclass = 'river' OR fclass = 'stream' OR fclass = 'canal' THEN 'river' 
            WHEN fclass = 'lake' OR fclass = 'reservoir' THEN 'lake'
            WHEN fclass = 'forest' OR fclass = 'wood' OR fclass = 'park' THEN 'forest'
            ELSE '$internal_type' 
        END,
        COALESCE(NULLIF(name, ''), 'Unknown ' || fclass),
        'OSM ' || fclass || ' (Full metadata)',
        to_jsonb(tmp_import.*) - 'geom' - 'fid',
        geom
      FROM tmp_import;
    "
}

# Load every single layer from the archive with full metadata
load_layer_pro "gis_osm_water_a_free" "lake"
load_layer_pro "gis_osm_waterways_free" "river"
load_layer_pro "gis_osm_roads_free" "road"
load_layer_pro "gis_osm_railways_free" "road"
load_layer_pro "gis_osm_buildings_a_free" "building"
load_layer_pro "gis_osm_landuse_a_free" "forest"
load_layer_pro "gis_osm_natural_a_free" "forest"
load_layer_pro "gis_osm_pois_free" "other"
load_layer_pro "gis_osm_places_free" "city"
load_layer_pro "gis_osm_transport_a_free" "other"
load_layer_pro "gis_osm_pois_a_free" "other"
load_layer_pro "gis_osm_natural_free" "other"
load_layer_pro "gis_osm_places_a_free" "city"

echo "-------------------------------------------------"
echo "Finalizing Pro Import..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS tmp_import;"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "ANALYZE geo_objects;"

echo "PRO DONE! Every attribute is now in the 'metadata' column."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM geo_objects;"
