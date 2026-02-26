#!/bin/bash
# High-performance script to load ALL GeoPackage data into PostGIS
# Uses ogr2ogr direct PG connection for maximum reliability

DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="kzmap"
DB_USER="kzmap_user"
DB_PASS="kzmap_password"
GPKG_FILE="gpkg_data/kazakhstan.gpkg"
OWNER_ID="00000000-0000-0000-0000-000000000001" # Admin user

export PGPASSWORD=$DB_PASS

echo "================================================="
echo "   GeoPackage to PostGIS Robust Loader"
echo "================================================="

# Clean up existing data to avoid duplicates/mess
echo "Cleaning up existing data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE geo_objects CASCADE;"

# Function to load a layer directly
load_layer() {
    local layer_name=$1
    local internal_type=$2
    local filter=$3
    local limit=$4
    
    echo "-------------------------------------------------"
    echo "Loading layer: $layer_name -> Type: $internal_type"
    
    # Use ogr2ogr to load into a temporary table first
    ogr2ogr -f PostgreSQL "PG:host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME password=$DB_PASS" \
      $GPKG_FILE $layer_name \
      -nln tmp_import -overwrite \
      -select "fclass,name" \
      -t_srs EPSG:4326 \
      ${limit:+-limit $limit} \
      ${filter:+-where "$filter"} \
      -nlt PROMOTE_TO_MULTI \
      -lco OVERWRITE=YES

    echo "Transferring from tmp_import to geo_objects..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
      INSERT INTO geo_objects (owner_id, scope, type, name, description, geometry)
      SELECT 
        '$OWNER_ID',
        'global',
        CASE WHEN fclass = 'river' THEN 'river' ELSE '$internal_type' END,
        COALESCE(NULLIF(name, ''), 'Unknown ' || fclass),
        'Imported from OSM ' || fclass,
        geom
      FROM tmp_import;
    "
}

# 1. Load Waters (lakes/rivers)
load_layer "gis_osm_water_a_free" "lake" ""
load_layer "gis_osm_waterways_free" "river" "fclass IN ('river', 'canal', 'stream')"

# 2. Load Roads (Major roads) - Limit to 100k for performance
load_layer "gis_osm_roads_free" "road" "fclass IN ('motorway', 'trunk', 'primary', 'secondary')" 100000

# 3. Load Buildings - Limit to 100k for performance (the full dataset is millions, too much for this environment)
load_layer "gis_osm_buildings_a_free" "building" "" 100000

# 4. Load Natural (Forests)
load_layer "gis_osm_landuse_a_free" "forest" "fclass = 'forest'"
load_layer "gis_osm_natural_a_free" "forest" "fclass = 'forest' OR fclass = 'wood'"

echo "-------------------------------------------------"
echo "Finalizing..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP TABLE IF EXISTS tmp_import;"
# Re-run subdivision for the new data
echo "Subdividing complex geometries..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/optimize_spatial.sql

echo "Data import and optimization complete!"
