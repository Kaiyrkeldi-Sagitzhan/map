#!/bin/bash
# RAW GeoPackage to PostGIS Loader
# No optimization, just pure data from the source

DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="kzmap"
DB_USER="kzmap_user"
DB_PASS="kzmap_password"
GPKG_FILE="gpkg_data/kazakhstan.gpkg"
OWNER_ID="00000000-0000-0000-0000-000000000001" # Admin user

export PGPASSWORD=$DB_PASS

echo "================================================="
echo "   RAW FULL GeoPackage to PostGIS Loader"
echo "================================================="

echo "Cleaning up existing data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE geo_objects CASCADE;"

load_layer() {
    local layer_name=$1
    local internal_type=$2
    
    echo "-------------------------------------------------"
    echo "Loading layer: $layer_name -> Type: $internal_type"
    
    # Using ogr2ogr to pump data directly into Postgres
    ogr2ogr -f PostgreSQL "PG:host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME password=$DB_PASS" \
      $GPKG_FILE $layer_name \
      -nln tmp_import -overwrite \
      -select "fclass,name" \
      -t_srs EPSG:4326 \
      -nlt PROMOTE_TO_MULTI \
      -lco OVERWRITE=YES

    echo "Transferring data to geo_objects..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
      INSERT INTO geo_objects (owner_id, scope, type, name, description, geometry)
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
        'Imported from OSM ' || fclass,
        geom
      FROM tmp_import;
    "
}

# Load all available layers without any filters or limits
load_layer "gis_osm_water_a_free" "lake"
load_layer "gis_osm_waterways_free" "river"
load_layer "gis_osm_roads_free" "road"
load_layer "gis_osm_railways_free" "road"
load_layer "gis_osm_buildings_a_free" "building"
load_layer "gis_osm_landuse_a_free" "forest"
load_layer "gis_osm_natural_a_free" "forest"
load_layer "gis_osm_pois_free" "other"
load_layer "gis_osm_places_free" "city"
load_layer "gis_osm_pois_a_free" "other"
load_layer "gis_osm_natural_free" "other"
load_layer "gis_osm_places_a_free" "city"

echo "-------------------------------------------------"
echo "Finalizing raw import..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS tmp_import;"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "ANALYZE geo_objects;"

echo "RAW DONE! Total objects in database:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM geo_objects;"
