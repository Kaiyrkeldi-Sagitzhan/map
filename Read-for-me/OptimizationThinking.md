# Optimization Plan: 4M Vector Objects on Kazakhstan Map

## Server Hardware

```
CPU:  AMD Ryzen 5 3600X (6 cores / 12 threads, 3.8-4.4 GHz)
RAM:  16 GB DDR4
GPU1: NVIDIA Tesla V100 16 GB (5120 CUDA cores, 900 GB/s HBM2)
GPU2: NVIDIA GTX 1650 Super 4 GB (1280 CUDA cores)
Disk: 250 GB NVMe SSD
```

---

## Current Architecture Analysis

### What happens now when a user opens the map

```
Browser request: GET /api/map/tiles/5/12/10.pbf
    |
    v
[Nginx] --> no cache, just proxy
    |
    v
[Go map-service] --> check Redis cache (key: tile:5:12:10)
    |
    +--> Cache HIT:  return binary tile (~1ms)
    +--> Cache MISS: go to PostGIS
            |
            v
        [PostGIS SQL]:
            WITH bounds AS (SELECT ST_TileEnvelope(5, 12, 10) AS geom),
            mvt_geom AS (
                SELECT id, name, type, metadata,
                       ST_AsMVTGeom(ST_Transform(geometry, 3857), bounds.geom, 4096, 256, true) AS geom
                FROM geo_objects, bounds
                WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
            )
            SELECT ST_AsMVT(mvt_geom.*, 'objects') FROM mvt_geom;
            |
            v
        Result: binary protobuf tile --> cache in Redis (TTL: 24h) --> return to browser
```

### Current bottlenecks (in order of severity)

1. **Critical: Missing SRID 3857 index.** Your GIST index is on `geometry` (SRID 4326), but the tile query uses `ST_Transform(geometry, 3857)`. PostGIS must transform ALL 4M rows before checking intersection. This is a full table scan on every uncached tile request.

2. **No tile pregeneration.** First user to view any area waits 200-2000ms per tile. A single viewport loads 12-20 tiles. First load = 3-10 seconds of blank tiles appearing.

3. **No Nginx cache layer.** Every tile request hits Go service + Redis, even though tiles are static 99.9% of the time.

4. **Default PostgreSQL settings.** PostGIS is allocated ~128MB shared_buffers by default. With 4M spatial objects, this causes constant disk I/O.

5. **No Docker resource limits.** All containers compete for the same 16GB RAM. PostgreSQL, Redis, and Go can starve each other.

---

## Optimization Plan (5 steps)

### Step 1: PostgreSQL SRID 3857 Index (Biggest single improvement)

**Problem explained simply:**

Your data is stored in SRID 4326 (latitude/longitude degrees). The tile query needs SRID 3857 (Web Mercator meters). For every tile request, PostGIS does this:

```
For each of 4,000,000 rows:
    1. Read geometry from disk (4326)
    2. Transform to 3857 (math: project lat/lng to meters)
    3. Check if it intersects the tile bounds
```

The GIST index on `geometry` (4326) helps a bit, but PostGIS still has to transform every candidate row.

**Solution:**

Create a functional index that stores pre-transformed geometries:

```sql
-- Run this on the server after deployment
-- Takes ~5-15 minutes on first run, then instant for all future queries

CREATE INDEX CONCURRENTLY idx_geo_objects_geometry_3857
    ON geo_objects USING GIST (ST_Transform(geometry, 3857));

-- After index is built:
VACUUM ANALYZE geo_objects;
```

Also update the tile SQL query to use a more efficient pattern:

```sql
-- Current (slow):
WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)

-- Better (uses the new index):
WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
-- PostgreSQL will automatically use idx_geo_objects_geometry_3857
-- because the expression matches the index definition exactly
```

The index stores pre-computed 3857 geometries in the GIST tree. Now PostGIS can use the index directly without transforming each row at query time.

**Expected improvement: 5-20x faster tile generation (200ms -> 10-40ms)**

**Migration file to create:**

```sql
-- database/migrations/004_spatial_3857_index.sql

-- Functional GIST index for MVT tile generation
-- Matches the expression in GetTileMVT: ST_Transform(geometry, 3857)
-- This eliminates per-row coordinate transformation during tile queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geo_objects_geometry_3857
    ON geo_objects USING GIST (ST_Transform(geometry, 3857));

-- Analyze table so query planner uses the new index
ANALYZE geo_objects;
```

### Step 2: PostgreSQL Configuration Tuning

**Current state:** PostGIS runs with default config designed for a laptop with 1GB RAM.

Create file `database/postgresql.conf` with settings tuned for your server:

```ini
# === Memory ===
# 25% of total RAM for PostgreSQL internal cache
shared_buffers = 4GB

# Tell planner how much RAM the OS caches (total RAM minus other services)
effective_cache_size = 10GB

# Per-query memory for sorts and spatial operations
# 4M objects with spatial joins need this
work_mem = 256MB

# Memory for VACUUM, CREATE INDEX
maintenance_work_mem = 1GB

# === Parallelism ===
# Ryzen 5 3600X has 12 threads, give PostGIS 4 for parallel queries
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
parallel_tuple_cost = 0.01
parallel_setup_cost = 100

# === WAL (Write-Ahead Log) ===
# Larger WAL for better write performance during data imports
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB

# === Planner ===
# NVMe SSD: random reads are almost as fast as sequential
random_page_cost = 1.1
effective_io_concurrency = 200

# === PostGIS specific ===
# Allow larger geometries in memory
max_locks_per_transaction = 128
```

Mount this in docker-compose.yml:

```yaml
postgres:
    image: postgis/postgis:15-3.3
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      # ... other volumes
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 6G
```

**Expected improvement: 2-5x faster queries, especially for concurrent users**

### Step 3: Tile Pregeneration Service

**The idea:** After Docker starts and database is ready, a background service generates all tiles for zoom levels 3-12 and stores them in Redis. Users never see "loading" for common zoom levels.

**Math:**

```
Zoom  | Total tiles worldwide | Tiles covering Kazakhstan* | Avg tile size | Total Redis memory
------|-----------------------|---------------------------|---------------|------------------
  3   |            64         |          ~4               |    30 KB      |      120 KB
  4   |           256         |         ~12               |    25 KB      |      300 KB
  5   |         1,024         |         ~30               |    20 KB      |      600 KB
  6   |         4,096         |        ~100               |    18 KB      |      1.8 MB
  7   |        16,384         |        ~350               |    15 KB      |      5.3 MB
  8   |        65,536         |      ~1,200               |    12 KB      |     14.4 MB
  9   |       262,144         |      ~4,500               |    10 KB      |     45 MB
 10   |     1,048,576         |     ~17,000               |     8 KB      |    136 MB
 11   |     4,194,304         |     ~65,000               |     6 KB      |    390 MB
 12   |    16,777,216         |    ~250,000               |     4 KB      |   1000 MB
------|-----------------------|---------------------------|---------------|------------------
TOTAL |                       |    ~338,000               |               |   ~1.6 GB
```

*Kazakhstan bounding box: lat 40.5-55.5, lng 46.5-87.5

With the 3857 index from Step 1, each tile generates in ~10-40ms.
- 338,000 tiles / 12 threads / 25ms avg = ~18 minutes to pregenerate everything.
- Can be done in parallel with 4 goroutines: ~8 minutes total.

**Implementation approach:**

Create a new Go service or add to map-service startup:

```go
// Pseudocode for tile pregeneration
func PregenerateTiles(repo *GeoObjectRepository, cache *RedisCache) {
    // Kazakhstan bounding box in Web Mercator
    kzBounds := [4]float64{46.5, 40.5, 87.5, 55.5} // minLng, minLat, maxLng, maxLat

    for z := 3; z <= 12; z++ {
        tiles := getTilesForBounds(kzBounds, z)
        log.Printf("Zoom %d: %d tiles to generate", z, len(tiles))

        // Process in parallel (4 workers)
        sem := make(chan struct{}, 4)
        for _, t := range tiles {
            sem <- struct{}{}
            go func(z, x, y int) {
                defer func() { <-sem }()

                // Check if already cached
                cached, _ := cache.GetTile(ctx, z, x, y)
                if cached != nil { return }

                // Generate and cache
                tile, err := repo.GetTileMVT(ctx, z, x, y)
                if err == nil && len(tile) > 0 {
                    cache.SetTile(ctx, z, x, y, tile)
                }
            }(t.z, t.x, t.y)
        }
    }
}
```

**Redis memory for pregenerated tiles:** ~1.6 GB

Your server has 16 GB RAM. Allocation:
- PostgreSQL: 6 GB (shared_buffers 4GB + work_mem)
- Redis: 3 GB (1.6 GB tiles + 1 GB headroom for bbox cache, lists, etc.)
- Go services: ~500 MB
- OS + filesystem cache: ~6 GB
- Total: ~16 GB (fits perfectly)

Configure Redis max memory in docker-compose.yml:

```yaml
redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 3gb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          memory: 3G
```

`allkeys-lru` means when Redis hits 3GB, it evicts least-recently-used tiles. Zoom 13+ tiles that were requested once will be evicted first. Frequently viewed zoom 3-12 tiles stay in cache.

**Expected improvement: first page load goes from 3-10s to instant for zoom 3-12**

### Step 4: Nginx Tile Cache (Disk-based)

**Why:** Even with Redis, every tile request goes through: Nginx -> Go -> Redis -> Go -> Nginx. Adding Nginx disk cache eliminates Go and Redis from the path entirely for cached tiles.

```
Without Nginx cache:  Nginx -> Go -> Redis -> Go -> Nginx  (~5-10ms)
With Nginx cache:     Nginx -> disk read -> Nginx            (~1ms)
```

Update `nginx/nginx.conf`:

```nginx
http {
    # ... existing config ...

    # Tile cache: 5GB on disk, 10MB for keys in memory
    proxy_cache_path /tmp/tile_cache
        levels=1:2
        keys_zone=tiles:10m
        max_size=5g
        inactive=7d
        use_temp_path=off;

    server {
        # ... existing config ...

        location /api/map/tiles/ {
            # CORS headers (keep existing)
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

            # Cache config
            proxy_cache tiles;
            proxy_cache_valid 200 7d;
            proxy_cache_valid 204 404 1m;
            proxy_cache_key "$uri";
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;

            # Tell browser to cache tiles too
            add_header Cache-Control "public, max-age=86400, stale-while-revalidate=604800" always;
            add_header X-Cache-Status $upstream_cache_status always;

            proxy_pass $map_service_url;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

**Cache invalidation:** When a geo_object is edited, call `PURGE` on affected tiles, or just let the 7-day TTL handle it (tiles don't change often in production).

**Expected improvement: repeat tile requests served in ~1ms instead of ~5-10ms, reduces load on Go/Redis**

### Step 5: Docker Resource Limits

Without limits, one container can starve others. Set explicit limits:

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 6G

  redis:
    command: redis-server --maxmemory 3gb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 3G

  map-service:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G

  auth-service:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

Note: Ryzen 5 3600X has 12 threads. Docker sees them as 12 CPUs. The limits above can overlap because not all services are busy at the same time.

---

## GPU Analysis: Tesla V100 and GTX 1650 Super

### Can the Tesla V100 help with map rendering?

**Short answer: Not for serving MVT vector tiles to browsers.**

**Why:**

1. **MVT tiles are generated by PostGIS (CPU).** The SQL functions `ST_AsMVTGeom`, `ST_Transform`, `ST_Intersects` run on CPU. PostGIS has no GPU support. The tile is a binary protobuf file generated server-side.

2. **Vector tiles are drawn by the browser (client GPU).** When the browser receives the .pbf tile, it uses canvas/WebGL to draw polygons on screen. This happens on the USER's GPU, not the server's GPU. Leaflet uses Canvas renderer by default. MapLibre GL JS uses WebGL. Both run client-side.

3. **The server GPU is never involved in rendering.** The server's job is: receive tile request -> return binary protobuf data. No pixels are rendered on the server.

### Where a GPU CAN help (advanced, not needed now)

| Use case | GPU useful? | Complexity | Priority |
|----------|-------------|------------|----------|
| MVT tile generation (PostGIS) | No | - | - |
| Browser map rendering | No (client-side) | - | - |
| Pre-rendering raster tiles from vector data | Yes (V100) | High | Low |
| ML-based feature extraction from satellite imagery | Yes (V100) | Very high | Future |
| Spatial analytics (cuSpatial/RAPIDS) | Yes (V100) | High | Future |
| Database acceleration (GPU-accelerated DB like HeavyDB) | Yes (V100) | Very high | Not recommended |

**The one scenario where V100 makes sense:** If you want to pre-render 4M objects into static raster tile images (PNG/JPEG) at all zoom levels, you could use a GPU-accelerated renderer. But this requires completely different software (not PostGIS/Leaflet) and produces huge tile sets (100+ GB for all zoom levels). Not worth it when vector tiles work well.

### Recommendation for your GPUs

- **Tesla V100:** Leave it idle for the map project. Reserve it for future ML/analytics tasks (satellite image processing, spatial clustering, anomaly detection).
- **GTX 1650 Super:** Use for display output (monitor). Not useful for server-side map work.

**The bottleneck is CPU (PostGIS) and RAM (caching), not GPU.**

---

## Critical: Dynamic Data Optimization (frequently edited objects)

### Current Bug: Tiles NOT invalidated after edits

Looking at `geo_object_service.go`, when an object is created/updated/deleted:

```go
// In Create(), Update(), Delete():
if s.cache != nil {
    _ = s.cache.InvalidateLists(ctx)   // clears geo_objects:list:* and geo_objects:bbox:*
    _ = s.cache.InvalidateStats(ctx)   // clears dashboard:stats
}
// MISSING: tile cache invalidation!
// Tiles (key: tile:z:x:y) stay cached for 24 hours showing OLD data
```

**Result:** An editor changes a building, but all users see the old building for 24 hours until the Redis tile TTL expires. This is the first thing to fix.

### What exactly eats CPU when generating tiles

The tile SQL query does 4 operations per row:

```
Operation                              | CPU cost per row | What it does
---------------------------------------|------------------|---------------------------------------------
1. ST_Transform(geometry, 3857)        | HIGH             | Convert lat/lng degrees to meters (trig math)
2. ST_Intersects(..., bounds.geom)     | MEDIUM           | Check if geometry overlaps the tile area
3. ST_AsMVTGeom(..., 4096, 256, true)  | HIGH             | Clip geometry to tile bounds, simplify to 4096 grid
4. ST_AsMVT(*, 'objects')              | MEDIUM           | Encode all features into protobuf binary
```

At zoom 5 (country view), one tile may contain **hundreds of thousands of objects**. PostGIS must process each one. This is where 90% of CPU goes.

At zoom 14+ (street view), a tile contains 10-200 objects. Fast regardless of optimization.

**Key insight:** Low zoom tiles (3-8) are the expensive ones. They cover large areas with many objects. High zoom tiles are already fast.

### Solution Architecture: 3 layers of optimization for dynamic data

```
                 Edit happens (object modified)
                         |
                         v
        +------ Smart Tile Invalidation ------+
        |  Compute which tiles contain the     |
        |  edited object. Delete ONLY those    |
        |  tile keys from Redis + Nginx cache. |
        +--------------------------------------+
                         |
                         v
        +------ Background Regeneration -------+
        |  Asynchronously regenerate the        |
        |  invalidated tiles in a goroutine.    |
        |  Next user request gets fresh tile    |
        |  from Redis (already regenerated).    |
        +---------------------------------------+
                         |
                         v
        +------ Zoom-level Simplification ------+
        |  At zoom 3-8: ST_Simplify geometry    |
        |  before ST_AsMVTGeom. Reduce vertex   |
        |  count 10-100x. Massive CPU savings.  |
        +---------------------------------------+
```

### 1. Smart Tile Invalidation (fix the 24-hour stale data bug)

When an object is edited, we know its geometry. From the geometry, we can compute exactly which tiles at each zoom level contain it. Invalidate only those tiles instead of nothing (current bug) or everything (wasteful).

**Math:** A building at one location touches:
- Zoom 3: 1 tile
- Zoom 5: 1 tile
- Zoom 8: 1-2 tiles
- Zoom 10: 1-4 tiles
- Zoom 12: 1-4 tiles
- Zoom 14: 1-4 tiles
- **Total: ~15-25 tiles per edit** (out of 338,000+ cached tiles)

**Implementation for Redis cache (`redis_cache.go`):**

```go
// InvalidateTilesForGeometry deletes cached tiles that contain the given geometry.
// Called after Create/Update/Delete.
func (c *RedisCache) InvalidateTilesForBounds(ctx context.Context, minLat, minLng, maxLat, maxLng float64, maxZoom int) error {
    var keys []string

    for z := 3; z <= maxZoom; z++ {
        // Convert lat/lng to tile coordinates
        minX, minY := latLngToTile(maxLat, minLng, z) // note: maxLat = minY in tile coords
        maxX, maxY := latLngToTile(minLat, maxLng, z)

        for x := minX; x <= maxX; x++ {
            for y := minY; y <= maxY; y++ {
                keys = append(keys, fmt.Sprintf("tile:%d:%d:%d", z, x, y))
            }
        }
    }

    if len(keys) > 0 {
        if err := c.client.Del(ctx, keys...).Err(); err != nil {
            log.Printf("[ERROR] Failed to invalidate %d tile keys: %v", len(keys), err)
            return err
        }
        log.Printf("[INFO] Invalidated %d tile keys for bounds [%.4f,%.4f - %.4f,%.4f]",
            len(keys), minLat, minLng, maxLat, maxLng)
    }
    return nil
}

// latLngToTile converts lat/lng to tile coordinates at zoom z
// Standard "Slippy Map" formula: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
func latLngToTile(lat, lng float64, z int) (x, y int) {
    n := math.Pow(2, float64(z))
    x = int(math.Floor((lng + 180.0) / 360.0 * n))
    latRad := lat * math.Pi / 180.0
    y = int(math.Floor((1.0 - math.Log(math.Tan(latRad)+1.0/math.Cos(latRad))/math.Pi) / 2.0 * n))
    return x, y
}
```

**Call it from `geo_object_service.go` after Create/Update/Delete:**

```go
// After existing InvalidateLists call:
if s.cache != nil {
    _ = s.cache.InvalidateLists(ctx)
    _ = s.cache.InvalidateStats(ctx)

    // NEW: Invalidate affected tiles
    // Extract geometry bounds from the object
    bounds := geometry.GetBounds(obj.Geometry) // returns minLat, minLng, maxLat, maxLng
    if bounds != nil {
        _ = s.cache.InvalidateTilesForBounds(ctx,
            bounds.MinLat, bounds.MinLng, bounds.MaxLat, bounds.MaxLng, 14)
    }
}
```

**Cost:** Deleting 15-25 Redis keys takes <1ms. No impact on edit performance.

### 2. Background Tile Regeneration After Edit

After invalidating stale tiles, regenerate them in the background so the next user gets an instant cache hit.

```go
// In geo_object_service.go, after tile invalidation:
go func() {
    bgCtx := context.Background()
    for z := 3; z <= 12; z++ { // Only pregenerate low-mid zooms
        minX, minY := latLngToTile(bounds.MaxLat, bounds.MinLng, z)
        maxX, maxY := latLngToTile(bounds.MinLat, bounds.MaxLng, z)
        for x := minX; x <= maxX; x++ {
            for y := minY; y <= maxY; y++ {
                tile, err := s.repo.GetTileMVT(bgCtx, z, x, y)
                if err == nil && tile != nil {
                    _ = s.cache.SetTile(bgCtx, z, x, y, tile)
                }
            }
        }
    }
    log.Printf("[INFO] Background tile regeneration complete for bounds [%.4f,%.4f]", bounds.MinLat, bounds.MinLng)
}()
```

**Cost:** Regenerating ~15 tiles at 10-40ms each = 150-600ms total in background. User doesn't wait.

### 3. Zoom-Level Geometry Simplification (biggest CPU saving for low zooms)

**The problem visualized:**

```
Zoom 5 (country view):
  A lake outline has 5,000 vertices.
  On screen at zoom 5, it occupies maybe 20x15 pixels.
  PostGIS processes all 5,000 vertices for a 20-pixel shape.

  After simplification: 8 vertices for the same 20-pixel shape.
  625x less work for the same visual result.
```

**Updated tile SQL with simplification:**

```sql
-- geo_object_repository.go GetTileMVT
WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS geom),
mvt_geom AS (
    SELECT id, name, type, metadata,
           ST_AsMVTGeom(
               CASE
                   -- At low zooms, simplify geometry before MVT conversion
                   -- Tolerance in meters: higher = more simplification
                   WHEN $1 <= 6  THEN ST_Simplify(ST_Transform(geometry, 3857), 1000)
                   WHEN $1 <= 9  THEN ST_Simplify(ST_Transform(geometry, 3857), 200)
                   WHEN $1 <= 12 THEN ST_Simplify(ST_Transform(geometry, 3857), 50)
                   ELSE ST_Transform(geometry, 3857)
               END,
               bounds.geom, 4096, 256, true
           ) AS geom
    FROM geo_objects, bounds
    WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
)
SELECT ST_AsMVT(mvt_geom.*, 'objects') FROM mvt_geom
WHERE geom IS NOT NULL;  -- ST_Simplify can return NULL for tiny features
```

**Simplification tolerance explained (in meters):**

```
Zoom | Tolerance | Effect                              | Tile generation speed
-----|-----------|-------------------------------------|---------------------
  3  |   1000m   | 1km precision. Lakes become blobs.  | 10-20x faster
  5  |   1000m   | Cities are dots. Roads are lines.   | 10-20x faster
  8  |    200m   | Building blocks visible. Smooth.    | 3-5x faster
 10  |     50m   | Individual large buildings visible. | 2-3x faster
 12  |     50m   | Most buildings have ~4 vertices.    | 2x faster
 14+ |      0    | Full detail. No simplification.     | No change
```

**Why this matters so much:** A typical lake or forest boundary has thousands of vertices. At zoom 5, the user sees a 20-pixel blob. Processing 5,000 vertices for a 20-pixel shape is 99.8% wasted CPU. `ST_Simplify` reduces it to 4-8 vertices with identical visual result.

**Expected improvement:** Low zoom tile generation 5-20x faster. Combined with the 3857 index = 25-100x faster than current state.

### 4. Type-Based Filtering in Tile Query (reduce objects per tile)

At low zooms, not all object types are visible or useful:

```
Zoom 3-5:  Show only lakes, rivers, forests, cities (large features)
Zoom 6-8:  Add roads (major ones)
Zoom 9-11: Add all roads
Zoom 12+:  Add buildings and everything else
```

**Updated query with type filtering:**

```sql
WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS geom),
mvt_geom AS (
    SELECT id, name, type, metadata,
           ST_AsMVTGeom(
               CASE
                   WHEN $1 <= 6  THEN ST_Simplify(ST_Transform(geometry, 3857), 1000)
                   WHEN $1 <= 9  THEN ST_Simplify(ST_Transform(geometry, 3857), 200)
                   WHEN $1 <= 12 THEN ST_Simplify(ST_Transform(geometry, 3857), 50)
                   ELSE ST_Transform(geometry, 3857)
               END,
               bounds.geom, 4096, 256, true
           ) AS geom
    FROM geo_objects, bounds
    WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
      AND (
          -- Zoom-based type filtering: don't load buildings at zoom 3
          $1 >= 12
          OR ($1 >= 9 AND type IN ('lake','river','forest','city','road','other'))
          OR ($1 >= 6 AND type IN ('lake','river','forest','city','road'))
          OR type IN ('lake','river','forest','city')
      )
)
SELECT ST_AsMVT(mvt_geom.*, 'objects') FROM mvt_geom
WHERE geom IS NOT NULL;
```

**Impact:** At zoom 5, instead of processing 4M objects, only ~300K (lakes+rivers+forests+cities) are checked. The 2.8M buildings are skipped entirely. That's 70% less rows to process.

### 5. Nginx Cache Invalidation for Dynamic Data

Since data changes often, the Nginx cache from Step 4 needs invalidation too. Two approaches:

**Option A: Short TTL (simple)**
```nginx
proxy_cache_valid 200 5m;  # 5 minutes instead of 7 days
```
Users see stale data for max 5 minutes. Simple, no code needed.

**Option B: Purge API (precise)**
Add nginx `proxy_cache_purge` module and call it from Go after tile invalidation:

```go
// After invalidating Redis tiles, also purge Nginx cache
for _, key := range invalidatedKeys {
    // key = "tile:7:76:44"
    parts := strings.Split(key, ":")
    url := fmt.Sprintf("http://api-gateway/api/map/tiles/%s/%s/%s.pbf", parts[1], parts[2], parts[3])
    http.NewRequest("PURGE", url, nil) // Nginx purge
}
```

**Recommendation:** Start with Option A (short TTL). If you need real-time updates after edits, switch to Option B.

### Complete Data Flow After Optimization

```
=== User views the map ===

Browser: GET /api/map/tiles/7/76/44.pbf
    |
    v
[Nginx disk cache] -- HIT? --> Return tile (1ms)
    |
    | MISS
    v
[Go map-service] --> [Redis cache] -- HIT? --> Return tile (2ms)
    |
    | MISS
    v
[PostGIS] -- optimized query:
    1. 3857 GIST index: find candidates (no per-row transform)
    2. Type filter: skip buildings at low zoom
    3. ST_Simplify: reduce vertices at low zoom
    4. ST_AsMVTGeom: clip to tile bounds
    5. ST_AsMVT: encode protobuf
    --> 10-50ms --> cache in Redis + Nginx --> return

=== Editor modifies an object ===

Go map-service: Update geo_object
    |
    v
1. Save to PostGIS
2. Record history
3. Compute affected tile coordinates from geometry bounds
4. Delete affected tile keys from Redis (~15-25 keys, <1ms)
5. (Optional) Purge Nginx cache for same tiles
6. Background goroutine: regenerate affected tiles (150-600ms async)
    |
    v
Next user request for those tiles: fresh data from Redis (2ms)
All other tiles: unchanged, still cached
```

---

## Alternative: PMTiles (Pre-baked tile archive)

**What it is:** Instead of generating tiles on-the-fly from PostGIS, you pre-generate ALL tiles once and store them in a single file. The file uses HTTP range requests — any static file server (Nginx, S3, Cloudflare R2) can serve tiles without any Go/PostGIS/Redis backend.

**How it works:**

```
Traditional (current):
  Browser -> Nginx -> Go -> Redis/PostGIS -> Go -> Nginx -> Browser

PMTiles:
  Browser -> Nginx -> static file (pmtiles) -> Browser
  (No Go, no Redis, no PostGIS for tile serving)
```

**Generation process:**

```bash
# 1. Export all objects to GeoJSON from PostGIS
ogr2ogr -f GeoJSON output.geojson \
  PG:"host=localhost dbname=kzmap user=kzmap_user password=kzmap_password" \
  -sql "SELECT id, name, type, metadata, geometry FROM geo_objects"

# 2. Convert GeoJSON to MBTiles (tippecanoe - industry standard)
tippecanoe -o kazakhstan.mbtiles \
  --minimum-zoom=3 \
  --maximum-zoom=14 \
  --layer=objects \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --force \
  output.geojson

# 3. Convert MBTiles to PMTiles
pmtiles convert kazakhstan.mbtiles kazakhstan.pmtiles
```

**Result:** A single `.pmtiles` file (~2-5 GB) that contains all tiles for all zoom levels. Served by Nginx as a static file with HTTP range requests.

**Pros:**
- Zero CPU usage for tile serving (just file reads)
- No PostGIS, no Redis, no Go needed for tile delivery
- Can be hosted on CDN (Cloudflare R2, AWS S3) for global distribution
- Instant tile delivery (~1ms latency)

**Cons:**
- Must regenerate the file when data changes (takes 10-30 minutes for 4M objects)
- Requires `tippecanoe` (C++ tool, needs compilation)
- Not suitable if data changes frequently (more than once per day)

**Verdict:** Only useful if you have a periodic batch workflow (e.g., nightly rebuild). Since you edit frequently, stick with the dynamic approach above. PMTiles can be a future optimization for the public viewer (read-only `/map` page) while the editor stays dynamic.

---

## Implementation Order

### Phase 1: Fix the bug + PostgreSQL tuning (1-2 hours)

1. Add tile invalidation to `redis_cache.go` + call from `geo_object_service.go`
2. Create 3857 GIST index migration
3. Create `database/postgresql.conf` with tuned settings
4. Mount config in docker-compose.yml, set resource limits
5. Add Nginx tile cache with 5-minute TTL

**Expected result:** Edits show on map within seconds. Tile generation 5-20x faster.

### Phase 2: Tile query optimization (1-2 hours)

1. Add `ST_Simplify` at low zooms to the tile SQL query
2. Add zoom-based type filtering (skip buildings at zoom 3-8)
3. Test with `EXPLAIN ANALYZE` before and after

**Expected result:** Low zoom tiles 10-50x faster. Zoom 5 goes from 2s to 50ms.

### Phase 3: Pregeneration + background regen (2-3 hours)

1. Add tile pregeneration on startup (zoom 3-12)
2. Add background regeneration after edits
3. Configure Redis max memory (3 GB, allkeys-lru)

**Expected result:** First page load instant. Edits regenerate affected tiles in background.

### Phase 4: PMTiles for viewer (optional, 3-4 hours)

Only if you want the `/map` page (read-only for users) to be completely independent of PostGIS. Run a nightly cron job to regenerate PMTiles from PostGIS. Editor still uses live PostGIS tiles.

**Expected result:** `/map` page loads with zero CPU, `/editor` stays dynamic.

---

## Memory Budget for 16 GB RAM

```
Component              | Allocated | Purpose
-----------------------|-----------|----------------------------------------
PostgreSQL             | 6 GB      | shared_buffers (4GB) + work_mem + OS cache
Redis                  | 3 GB      | Pregenerated tiles + query cache
Go map-service         | 512 MB    | HTTP server + tile generation workers
Go auth-service        | 256 MB    | Authentication
Nginx                  | 256 MB    | Reverse proxy + disk cache index
Frontend (build only)  | 256 MB    | Serves static files
Linux OS + fs cache    | 5.5 GB    | Filesystem cache, kernel, buffers
-----------------------|-----------|----------------------------------------
TOTAL                  | ~16 GB    |
```

---

## Expected Performance After Optimization

### Before optimization (current state)

| Metric | Value |
|--------|-------|
| Cold tile load (no cache) | 200-2000 ms per tile |
| First page load (12-20 tiles) | 3-10 seconds |
| Warm tile load (Redis cache) | 5-10 ms per tile |
| PostGIS tile query | Full table scan (no 3857 index) |
| Concurrent users before degradation | ~5-10 |

### After Phase 1 (PostgreSQL tuning + 3857 index + Nginx cache)

| Metric | Value |
|--------|-------|
| Cold tile load (no cache) | 10-80 ms per tile |
| First page load | 0.5-2 seconds |
| Warm tile load (Nginx cache) | 1 ms per tile |
| PostGIS tile query | Index scan (3857 GIST) |
| Concurrent users before degradation | ~50-100 |

### After Phase 2 (+ pregeneration)

| Metric | Value |
|--------|-------|
| Cold tile load (zoom 3-12) | 1-5 ms (from Redis) |
| Cold tile load (zoom 13+) | 10-80 ms (PostGIS) |
| First page load | Instant (<500 ms) |
| Concurrent users before degradation | ~200+ |

### After Phase 3 (+ PMTiles)

| Metric | Value |
|--------|-------|
| Any tile load | 1 ms (static file) |
| CPU usage for tile serving | 0% |
| Concurrent users before degradation | 1000+ (limited by Nginx/bandwidth) |

---

## Quick Reference: Commands to Run on Server

```bash
# Phase 1: After deploying the new config files

# 1. Create the 3857 index (run inside postgres container)
docker exec -it kzmap-postgres psql -U kzmap_user -d kzmap -c "
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geo_objects_geometry_3857
    ON geo_objects USING GIST (ST_Transform(geometry, 3857));
ANALYZE geo_objects;"

# 2. Check the index was created
docker exec -it kzmap-postgres psql -U kzmap_user -d kzmap -c "
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
FROM pg_indexes WHERE tablename = 'geo_objects';"

# 3. Test tile generation speed (before vs after index)
docker exec -it kzmap-postgres psql -U kzmap_user -d kzmap -c "
EXPLAIN ANALYZE
WITH bounds AS (SELECT ST_TileEnvelope(7, 76, 44) AS geom),
mvt_geom AS (
    SELECT id, name, type, metadata,
           ST_AsMVTGeom(ST_Transform(geometry, 3857), bounds.geom, 4096, 256, true) AS geom
    FROM geo_objects, bounds
    WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
)
SELECT ST_AsMVT(mvt_geom.*, 'objects') FROM mvt_geom;"

# 4. Restart with new config
docker compose down && docker compose up -d

# 5. Monitor memory usage
docker stats --no-stream

# 6. Check Redis memory usage
docker exec -it kzmap-redis redis-cli INFO memory | grep used_memory_human

# 7. Flush Redis tile cache (if needed after data changes)
docker exec -it kzmap-redis redis-cli KEYS "tile:*" | wc -l
docker exec -it kzmap-redis redis-cli --scan --pattern "tile:*" | xargs docker exec -i kzmap-redis redis-cli DEL
```
