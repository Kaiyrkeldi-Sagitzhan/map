#!/bin/bash
set -e

# Load the data dump only if the geo_objects table is empty
# This script is intended to be run by the PostgreSQL entrypoint
# It checks if we have any data, and if not, it loads the provided dump

echo "Checking if geo_objects table needs data initialization..."
COUNT=$(psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT count(*) FROM geo_objects;")

if [ "$COUNT" -le 1 ]; then
    echo "Table geo_objects has $COUNT objects. Starting data import from dump..."
    if [ -f "/docker-entrypoint-initdb.d/data_dump.sql.gz.bak" ]; then
        gunzip -c /docker-entrypoint-initdb.d/data_dump.sql.gz.bak | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
        echo "Data import completed successfully."
    else
        echo "Warning: /docker-entrypoint-initdb.d/data_dump.sql.gz.bak not found. Skipping import."
    fi
else
    echo "Table geo_objects already has $COUNT objects. Skipping data initialization."
fi
