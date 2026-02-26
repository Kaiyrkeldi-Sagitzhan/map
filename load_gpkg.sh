#!/bin/bash
# Script to load sample data from GeoPackage to PostGIS geo_objects table

DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="kzmap"
DB_USER="kzmap_user"
DB_PASS="kzmap_password"
GPKG_FILE="gpkg_data/kazakhstan.gpkg"
OWNER_ID="00000000-0000-0000-0000-000000000001" # admin user

echo "Loading water bodies..."
# 1. Сначала выгрузим в GeoJSON, предварительно отфильтровав только крупные объекты
ogr2ogr -f GeoJSON water.geojson $GPKG_FILE gis_osm_water_a_free \
  -t_srs EPSG:4326 \
  -where "fclass='lake' OR fclass='reservoir'" \
  -limit 50

echo "Loading roads..."
ogr2ogr -f GeoJSON roads.geojson $GPKG_FILE gis_osm_roads_free \
  -t_srs EPSG:4326 \
  -where "fclass='motorway' OR fclass='trunk'" \
  -limit 50

# Now a quick JS/Node script to read GeoJSON and insert into Postgres via API or raw SQL
# We'll write a simple Python script to format SQL inserts
cat << 'EOF' > insert_data.py
import json
import uuid

def process_file(filename, obj_type):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    inserts = []
    for feat in data['features']:
        props = feat.get('properties', {})
        geom = feat.get('geometry')
        if not geom:
            continue
            
        name = props.get('name') or f"Unknown {obj_type}"
        # escape single quotes
        name = name.replace("'", "''")
        
        # We use ST_GeomFromGeoJSON for PostGIS
        geom_json = json.dumps(geom).replace("'", "''")
        
        uid = str(uuid.uuid4())
        owner = "00000000-0000-0000-0000-000000000001"
        
        sql = f"INSERT INTO geo_objects (id, owner_id, scope, type, name, description, geometry) VALUES ('{uid}', '{owner}', 'global', '{obj_type}', '{name}', 'Loaded from OSM GeoPackage', ST_SetSRID(ST_GeomFromGeoJSON('{geom_json}'), 4326));"
        inserts.append(sql)
        
    return inserts

all_sql = []
all_sql.extend(process_file('water.geojson', 'lake'))
all_sql.extend(process_file('roads.geojson', 'road'))

with open('load.sql', 'w') as f:
    f.write('\n'.join(all_sql))

print(f"Generated {len(all_sql)} SQL statements in load.sql")
EOF

python3 insert_data.py

echo "Executing SQL statements in PostGIS..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f load.sql

echo "Cleaning up..."
rm water.geojson roads.geojson insert_data.py load.sql

echo "Done!"
