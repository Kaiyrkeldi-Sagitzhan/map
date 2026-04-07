#!/bin/bash
# rebuild.sh — Full stack rebuild automation for kzmap
#
# Usage:
#   ./build/rebuild.sh [options]
#
# Options:
#   --cache           Use Docker layer cache (default: no-cache)
#   --frontend-only   Rebuild only the frontend image
#   --backend-only    Rebuild only auth-service and map-service images
#   --with-data       Re-import GPKG geodata into PostGIS after rebuild
#   --bake            Warm up Redis tile cache after rebuild
#   --down            docker compose down before rebuild (removes containers)
#   --help            Show this help message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${CYAN}[rebuild]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}\n"; }

# Force classic Docker builder — buildx causes socket errors on this setup
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# ── Defaults ──────────────────────────────────────────────────
OPT_NO_CACHE=true
OPT_FRONTEND_ONLY=false
OPT_BACKEND_ONLY=false
OPT_WITH_DATA=false
OPT_BAKE=false
OPT_DOWN=false

# ── Parse args ────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --cache)         OPT_NO_CACHE=false ;;
    --no-cache)      OPT_NO_CACHE=true ;;
    --frontend-only) OPT_FRONTEND_ONLY=true ;;
    --backend-only)  OPT_BACKEND_ONLY=true ;;
    --with-data)     OPT_WITH_DATA=true ;;
    --bake)          OPT_BAKE=true ;;
    --down)          OPT_DOWN=true ;;
    --help)
      sed -n '/^# rebuild/,/^[^#]/{ /^[^#]/d; s/^# \{0,2\}//; p }' "$0"
      exit 0
      ;;
    *)
      error "Unknown option: $arg"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

BUILD_ARGS=""
$OPT_NO_CACHE && BUILD_ARGS="--no-cache"

# ── Determine which services to rebuild ───────────────────────
if $OPT_FRONTEND_ONLY; then
  BUILD_SERVICES="frontend"
elif $OPT_BACKEND_ONLY; then
  BUILD_SERVICES="auth-service map-service"
else
  BUILD_SERVICES=""  # all
fi

# ── Start ─────────────────────────────────────────────────────
header "kzmap rebuild"
log "Root:    $ROOT_DIR"
log "Options: no-cache=$OPT_NO_CACHE | frontend-only=$OPT_FRONTEND_ONLY | backend-only=$OPT_BACKEND_ONLY | with-data=$OPT_WITH_DATA | bake=$OPT_BAKE"
echo ""

cd "$BACKEND_DIR"

# ── Step 1: Down (optional) ───────────────────────────────────
if $OPT_DOWN; then
  log "Stopping and removing containers..."
  docker compose down
  success "Containers removed"
else
  log "Stopping running containers (keeping volumes)..."
  docker compose stop 2>/dev/null || true
fi

# ── Step 2: Build ─────────────────────────────────────────────
header "Building Docker images"

if [ -n "$BUILD_SERVICES" ]; then
  log "Building: $BUILD_SERVICES"
  # shellcheck disable=SC2086
  docker compose build $BUILD_ARGS $BUILD_SERVICES
else
  log "Building all services..."
  docker compose build $BUILD_ARGS
fi
success "Images built"

# ── Step 3: Start ─────────────────────────────────────────────
header "Starting services"
docker compose up -d --force-recreate --remove-orphans
success "Containers started"

# ── Step 4: Wait for health ───────────────────────────────────
log "Waiting for services to become healthy..."

wait_healthy() {
  local container="$1"
  local timeout="${2:-60}"
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    if [ "$status" = "healthy" ]; then
      success "$container is healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "  Waiting for $container... ${elapsed}s\r"
  done
  warn "$container did not become healthy in ${timeout}s (status: $status)"
  return 1
}

wait_healthy "kzmap-postgres" 90
wait_healthy "kzmap-redis"    30
wait_healthy "kzmap-auth-service" 60
wait_healthy "kzmap-map-service"  60

echo ""
success "All services healthy"

# ── Step 5: Cache — flush Redis ───────────────────────────────
header "Cache"
log "Flushing Redis tile cache..."
if docker exec kzmap-redis redis-cli FLUSHALL > /dev/null 2>&1; then
  success "Redis cache flushed"
else
  warn "Could not flush Redis (container may not be ready)"
fi

# ── Step 6: DB indices / ANALYZE ──────────────────────────────
log "Running ANALYZE on geo_objects..."
if docker exec -e PGPASSWORD=kzmap_password kzmap-postgres \
    psql -U kzmap_user -d kzmap -c "ANALYZE geo_objects;" > /dev/null 2>&1; then
  success "geo_objects analyzed"
else
  warn "ANALYZE skipped (table may not exist yet)"
fi

# ── Step 7: Re-import geodata (optional) ──────────────────────
if $OPT_WITH_DATA; then
  header "Importing GPKG geodata"
  if [ -f "$BACKEND_DIR/load_all_gpkg.sh" ]; then
    log "Running load_all_gpkg.sh..."
    bash "$BACKEND_DIR/load_all_gpkg.sh"
    success "Geodata imported"
  else
    error "load_all_gpkg.sh not found at $BACKEND_DIR/load_all_gpkg.sh"
    exit 1
  fi
fi

# ── Step 8: Bake tile cache (optional) ────────────────────────
if $OPT_BAKE; then
  header "Baking tile cache"
  if [ -f "$BACKEND_DIR/bake_map.sh" ]; then
    log "Running bake_map.sh..."
    bash "$BACKEND_DIR/bake_map.sh"
    success "Tile cache baked"
  else
    error "bake_map.sh not found at $BACKEND_DIR/bake_map.sh"
    exit 1
  fi
fi

# ── Final status ──────────────────────────────────────────────
header "Status"
docker compose ps
echo ""
success "Rebuild complete!"
echo ""
echo -e "  Frontend  → ${CYAN}http://localhost:3000${NC}"
echo -e "  API       → ${CYAN}http://localhost:8080${NC}"
echo -e "  Auth      → ${CYAN}http://localhost:8081${NC}"
echo -e "  Map       → ${CYAN}http://localhost:8082${NC}"
echo ""
