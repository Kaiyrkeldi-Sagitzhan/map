#!/bin/bash
# Map Baking Script (Cache Warmup) - PRO VERSION
# Crawls Kazakhstan and focuses deep baking on major cities.

API_URL="http://localhost:8082/api/map/tiles"
TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@kzmap.kz", "password":"admin_password"}' | grep -oP '(?<="token":")[^"]*')

if [ -z "$TOKEN" ]; then
    echo "Error: Could not login. Make sure services are running."
    exit 1
fi

echo "================================================="
echo "   KAZAKHSTAN MAP BAKER (ULTIMATE EDITION)"
echo "================================================="

bake_area() {
    local label=$1
    local z_min=$2
    local z_max=$3
    local x_min=$4
    local x_max=$5
    local y_min=$6
    local y_max=$7
    
    echo "--- Baking $label (Zooms $z_min to $z_max) ---"
    
    for ((z=z_min; z<=z_max; z++)); do
        # Calculate scale factor for tile coordinates relative to baseline
        # This is a simplified calculation for the script
        local scale=$(( 2**(z-z_min) ))
        local cur_x_min=$(( x_min * scale ))
        local cur_x_max=$(( (x_max + 1) * scale - 1 ))
        local cur_y_min=$(( y_min * scale ))
        local cur_y_max=$(( (y_max + 1) * scale - 1 ))
        
        local total=$(( (cur_x_max - cur_x_min + 1) * (cur_y_max - cur_y_min + 1) ))
        echo "Zoom $z: $total tiles..."
        
        local count=0
        for ((x=cur_x_min; x<=cur_x_max; x++)); do
            for ((y=cur_y_min; y<=cur_y_max; y++)); do
                curl -s -o /dev/null "$API_URL/$z/$x/$y.pbf?token=$TOKEN"
                count=$((count + 1))
                if (( count % 50 == 0 )); then
                    echo -ne "Progress: $count / $total\r"
                fi
            done
        done
        echo -e "\nZoom $z complete."
    done
}

# 1. Запекаем ВЕСЬ Казахстан (до зума 11 — это покрывает все трассы и реки)
# Baseline coords for Zoom 3
bake_area "Whole Country" 3 11 5 5 2 3

# 2. Глубокое запекание ГОРОДОВ (до зума 16 — до уровня домов)
# Мы берем локальные плитки для каждого города на зуме 11 и углубляемся
# Астана
bake_area "Astana Deep" 12 16 2544 2544 1334 1334
# Алматы 
bake_area "Almaty Deep" 12 16 2582 2582 1432 1332
# Шымкент
bake_area "Shymkent Deep" 12 16 2500 2500 1445 1445

echo "================================================="
echo "   ULTIMATE BAKING COMPLETE!"
echo "   Kazakhstan is ready for 1000 users."
echo "================================================="
