#!/bin/bash
# rebuild.sh — Interactive rebuild for kzmap
#
# Usage (interactive):
#   ./build/rebuild.sh
#
# Usage (non-interactive):
#   ./build/rebuild.sh <mode>
#
# Modes:
#   1  full-fast       Full rebuild with cache
#   2  full-slow       Full rebuild no-cache (clean)
#   3  backend-fast    Backend only with cache
#   4  backend-slow    Backend only no-cache
#   5  frontend-fast   Frontend only with cache
#   6  frontend-slow   Frontend only no-cache
#
# Extra flags (append after mode):
#   --with-data   Re-import GPKG geodata after rebuild
#   --bake        Warm up Redis tile cache after rebuild
#   --down        docker compose down before rebuild

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

export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

COMPOSE_BACKEND="-f $ROOT_DIR/docker-compose.backend.yml"
COMPOSE_FRONTEND="-f $ROOT_DIR/docker-compose.frontend.yml"
COMPOSE_ALL="$COMPOSE_BACKEND $COMPOSE_FRONTEND"

# ── Defaults ──────────────────────────────────────────────────
OPT_NO_CACHE=false
OPT_FRONTEND_ONLY=false
OPT_BACKEND_ONLY=false
OPT_WITH_DATA=false
OPT_BAKE=false
OPT_DOWN=false
MODE_CHOSEN=""

# ── Menu ──────────────────────────────────────────────────────
show_menu() {
  echo -e "\n${BOLD}${CYAN}  kzmap rebuild${NC}\n"
  echo -e "  ${BOLD}Полная пересборка${NC}"
  echo -e "  ${GREEN}1)${NC} full  fast   — все сервисы, с кешем   ${YELLOW}(быстро)${NC}"
  echo -e "  ${GREEN}2)${NC} full  slow   — все сервисы, без кеша   ${RED}(медленно, чисто)${NC}"
  echo -e ""
  echo -e "  ${BOLD}Только бэкенд${NC}"
  echo -e "  ${GREEN}3)${NC} back  fast   — auth + map, с кешем     ${YELLOW}(быстро)${NC}"
  echo -e "  ${GREEN}4)${NC} back  slow   — auth + map, без кеша    ${RED}(медленно, чисто)${NC}"
  echo -e ""
  echo -e "  ${BOLD}Только фронтенд${NC}"
  echo -e "  ${GREEN}5)${NC} front fast   — frontend, с кешем       ${YELLOW}(быстро)${NC}"
  echo -e "  ${GREEN}6)${NC} front slow   — frontend, без кеша      ${RED}(медленно, чисто)${NC}"
  echo -e ""
  echo -ne "  Выбери режим [1-6]: "
}

# ── Parse first arg as mode or flag ───────────────────────────
EXTRA_ARGS=()
if [ $# -gt 0 ]; then
  case "$1" in
    1|full-fast)      MODE_CHOSEN=1 ;;
    2|full-slow)      MODE_CHOSEN=2 ;;
    3|backend-fast)   MODE_CHOSEN=3 ;;
    4|backend-slow)   MODE_CHOSEN=4 ;;
    5|frontend-fast)  MODE_CHOSEN=5 ;;
    6|frontend-slow)  MODE_CHOSEN=6 ;;
    # Legacy flags kept for backward compat
    --frontend-only)  MODE_CHOSEN=5 ;;
    --backend-only)   MODE_CHOSEN=3 ;;
    --help)
      sed -n '/^# rebuild/,/^[^#]/{ /^[^#]/d; s/^# \{0,2\}//; p }' "$0"
      exit 0
      ;;
    *) error "Unknown mode: $1. Run without args for interactive menu."; exit 1 ;;
  esac
  shift
fi

# Parse remaining flags
for arg in "$@"; do
  case "$arg" in
    --with-data) OPT_WITH_DATA=true ;;
    --bake)      OPT_BAKE=true ;;
    --down)      OPT_DOWN=true ;;
    --cache)     ;; # ignored, mode controls cache
    --no-cache)  ;; # ignored, mode controls cache
    *) error "Unknown flag: $arg"; exit 1 ;;
  esac
done

# Interactive menu if no mode given
if [ -z "$MODE_CHOSEN" ]; then
  show_menu
  read -r MODE_CHOSEN
fi

# Apply mode
case "$MODE_CHOSEN" in
  1) OPT_NO_CACHE=false; OPT_FRONTEND_ONLY=false; OPT_BACKEND_ONLY=false; MODE_LABEL="Full fast" ;;
  2) OPT_NO_CACHE=true;  OPT_FRONTEND_ONLY=false; OPT_BACKEND_ONLY=false; MODE_LABEL="Full slow (no-cache)" ;;
  3) OPT_NO_CACHE=false; OPT_BACKEND_ONLY=true;   MODE_LABEL="Backend fast" ;;
  4) OPT_NO_CACHE=true;  OPT_BACKEND_ONLY=true;   MODE_LABEL="Backend slow (no-cache)" ;;
  5) OPT_NO_CACHE=false; OPT_FRONTEND_ONLY=true;  MODE_LABEL="Frontend fast" ;;
  6) OPT_NO_CACHE=true;  OPT_FRONTEND_ONLY=true;  MODE_LABEL="Frontend slow (no-cache)" ;;
  *) error "Invalid choice: $MODE_CHOSEN"; exit 1 ;;
esac

BUILD_ARGS=""
$OPT_NO_CACHE && BUILD_ARGS="--no-cache"

# Determine which compose files to use
if $OPT_FRONTEND_ONLY; then
  COMPOSE_USE="$COMPOSE_FRONTEND"
elif $OPT_BACKEND_ONLY; then
  COMPOSE_USE="$COMPOSE_BACKEND"
else
  COMPOSE_USE="$COMPOSE_ALL"
fi

# ── Start ─────────────────────────────────────────────────────
header "kzmap rebuild — $MODE_LABEL"
log "Root: $ROOT_DIR"
echo ""

cd "$ROOT_DIR"

# ── Step 1: Down / Stop ───────────────────────────────────────
if $OPT_DOWN; then
  log "Removing containers..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_USE down
  success "Containers removed"
else
  log "Stopping running containers (keeping volumes)..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_USE stop 2>/dev/null || true
fi

# ── Step 2: Build ─────────────────────────────────────────────
header "Building"

# For full rebuild: build backend first (frontend needs backend network)
if ! $OPT_FRONTEND_ONLY && ! $OPT_BACKEND_ONLY; then
  log "Building backend..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_BACKEND build $BUILD_ARGS
  log "Building frontend..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FRONTEND build $BUILD_ARGS
else
  log "Building..."
  # shellcheck disable=SC2086
  docker compose $COMPOSE_USE build $BUILD_ARGS
fi
success "Images built"

# ── Step 3: Start ─────────────────────────────────────────────
header "Starting"

# Backend must start first so the external network exists for frontend
if ! $OPT_FRONTEND_ONLY; then
  # shellcheck disable=SC2086
  docker compose $COMPOSE_BACKEND up -d --force-recreate --remove-orphans
fi
if ! $OPT_BACKEND_ONLY; then
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FRONTEND up -d --force-recreate --remove-orphans
fi
success "Containers started"

# ── Step 4: Health check ──────────────────────────────────────
log "Waiting for services..."

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

if $OPT_FRONTEND_ONLY; then
  : # skip health checks for frontend-only
else
  wait_healthy "kzmap-postgres"     90
  wait_healthy "kzmap-redis"        30
  wait_healthy "kzmap-auth-service" 60
  wait_healthy "kzmap-map-service"  60
  echo ""
  success "All services healthy"
fi

# ── Step 5: Redis flush (skip on frontend-only) ───────────────
if ! $OPT_FRONTEND_ONLY; then
  header "Cache"
  log "Flushing Redis tile cache..."
  if docker exec kzmap-redis redis-cli FLUSHALL > /dev/null 2>&1; then
    success "Redis cache flushed"
  else
    warn "Could not flush Redis"
  fi

  log "Running ANALYZE on geo_objects..."
  if docker exec -e PGPASSWORD=kzmap_password kzmap-postgres \
      psql -U kzmap_user -d kzmap -c "ANALYZE geo_objects;" > /dev/null 2>&1; then
    success "geo_objects analyzed"
  else
    warn "ANALYZE skipped (table may not exist yet)"
  fi
fi

# ── Step 6: Geodata import (optional) ────────────────────────
if $OPT_WITH_DATA; then
  header "Importing geodata"
  if [ -f "$BACKEND_DIR/load_all_gpkg.sh" ]; then
    bash "$BACKEND_DIR/load_all_gpkg.sh"
    success "Geodata imported"
  else
    error "load_all_gpkg.sh not found"; exit 1
  fi
fi

# ── Step 7: Bake cache (optional) ────────────────────────────
if $OPT_BAKE; then
  header "Baking tile cache"
  if [ -f "$BACKEND_DIR/bake_map.sh" ]; then
    bash "$BACKEND_DIR/bake_map.sh"
    success "Tile cache baked"
  else
    error "bake_map.sh not found"; exit 1
  fi
fi

# ── Done ──────────────────────────────────────────────────────
header "Done — $MODE_LABEL"
# shellcheck disable=SC2086
docker compose $COMPOSE_USE ps
echo ""
success "Rebuild complete!"
echo ""
echo -e "  Frontend  → ${CYAN}http://localhost:3000${NC}"
echo -e "  API       → ${CYAN}http://localhost:8080${NC}"
echo -e "  Auth      → ${CYAN}http://localhost:8081${NC}"
echo -e "  Map       → ${CYAN}http://localhost:8082${NC}"
echo -e "  Swagger   → ${CYAN}http://localhost:8083${NC}"
echo ""
