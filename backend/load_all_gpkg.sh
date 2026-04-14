#!/bin/bash
# PRO GeoPackage to PostGIS Loader
# Capturing EVERY SINGLE ATTRIBUTE for advanced cartography

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-kzmap}"
DB_USER="${DB_USER:-kzmap_user}"
DB_PASS="${DB_PASS:-kzmap_password}"
GPKG_FILE="${GPKG_FILE:-$SCRIPT_DIR/gpkg_data/kazakhstan.gpkg}"
OWNER_ID="00000000-0000-0000-0000-000000000001" # Admin user
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-kzmap-postgres}"

export PGPASSWORD=$DB_PASS

run_psql() {
  local sql="$1"

  if command -v psql >/dev/null 2>&1; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    docker exec -e PGPASSWORD="$DB_PASS" "$POSTGRES_CONTAINER" \
      psql -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi

  echo "ERROR: psql not found locally and postgres container '$POSTGRES_CONTAINER' is not running."
  echo "Run: docker compose up -d postgres"
  exit 1
}

run_ogr2ogr() {
  local layer_name="$1"
  local target_table="$2"
  local gpkg_basename
  gpkg_basename="$(basename "$GPKG_FILE")"

  if [ ! -f "$GPKG_FILE" ]; then
    echo "ERROR: GeoPackage file not found: $GPKG_FILE"
    echo "Set GPKG_FILE env var or place file at $SCRIPT_DIR/gpkg_data/kazakhstan.gpkg"
    exit 1
  fi

  if command -v ogr2ogr >/dev/null 2>&1; then
    ogr2ogr -f PostgreSQL "PG:host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME password=$DB_PASS" \
      "$GPKG_FILE" "$layer_name" \
      -nln "$target_table" -overwrite \
      -t_srs EPSG:4326 \
      -nlt PROMOTE_TO_MULTI \
      -lco OVERWRITE=YES
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker run --rm --network host -v "$SCRIPT_DIR/gpkg_data:/work" ghcr.io/osgeo/gdal:alpine-small-latest \
      ogr2ogr -f PostgreSQL "PG:host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME password=$DB_PASS" \
      "/work/$gpkg_basename" "$layer_name" \
      -nln "$target_table" -overwrite \
      -t_srs EPSG:4326 \
      -nlt PROMOTE_TO_MULTI \
      -lco OVERWRITE=YES
    return
  fi

  echo "ERROR: ogr2ogr not found locally and docker is unavailable for fallback."
  echo "Install GDAL or run with Docker installed."
  exit 1
}

echo "================================================="
echo "   ULTIMATE GeoPackage Attribute Importer"
echo "================================================="

# Prevent concurrent runs that can create conflicting temp objects.
LOCK_FILE="$SCRIPT_DIR/.load_all_gpkg.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "ERROR: Import is already running (pid: $LOCK_PID, lock: $LOCK_FILE)"
    exit 1
  fi
  echo "WARNING: Stale lock detected, removing: $LOCK_FILE"
  rm -f "$LOCK_FILE"
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo "$$" > "$LOCK_FILE"

echo "Cleaning up existing data..."
run_psql "TRUNCATE TABLE geo_objects CASCADE;"

load_layer_pro() {
  local layer_name="$1"
  local internal_type="$2"
  local table_suffix
  local tmp_table

  table_suffix="$(echo "$layer_name" | tr -c 'a-zA-Z0-9' '_' | tr '[:upper:]' '[:lower:]')"
  tmp_table="tmp_import_${table_suffix}_$$"
    
    echo "-------------------------------------------------"
    echo "Importing layer: $layer_name (with all attributes)"

    # Ensure failed previous runs don't leave this layer temp table behind.
    run_psql "DROP TABLE IF EXISTS $tmp_table CASCADE;"
    
    # Load into temp table with ALL columns (*)
    run_ogr2ogr "$layer_name" "$tmp_table"

    echo "Transferring data + generating metadata JSON..."
    # We use to_jsonb(temp_table.*) and subtract 'geom' and 'fid' to keep only attributes
    run_psql "
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
        to_jsonb($tmp_table.*) - 'geom' - 'fid',
        geom
      FROM $tmp_table
      WHERE '$internal_type' != 'forest'
         OR fclass IN ('forest', 'wood', 'park', 'nature_reserve', 'grass', 'meadow', 'scrub', 'heath');
    "

    run_psql "DROP TABLE IF EXISTS $tmp_table CASCADE;"
}

# Озёра
load_layer_pro "gis_osm_water_a_free" "lake"
# Реки
load_layer_pro "gis_osm_waterways_free" "river"
# Дороги
load_layer_pro "gis_osm_roads_free" "road"
# Леса (только полигоны landuse типа forest/wood/park)
load_layer_pro "gis_osm_landuse_a_free" "forest"

echo "-------------------------------------------------"
echo "Finalizing Pro Import..."
run_psql "ANALYZE geo_objects;"

echo "PRO DONE! Every attribute is now in the 'metadata' column."
run_psql "SELECT count(*) FROM geo_objects;"
