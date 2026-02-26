package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// RedisCache handles caching for geo objects
type RedisCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisCache creates a new RedisCache instance
func NewRedisCache(redisURL string) *RedisCache {
	client := redis.NewClient(&redis.Options{
		Addr: redisURL,
		DB:   0,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[WARNING] Failed to connect to Redis at %s: %v", redisURL, err)
	} else {
		log.Printf("[INFO] Successfully connected to Redis at %s", redisURL)
	}

	return &RedisCache{
		client: client,
		ttl:    1 * time.Hour, // cache lists for 1 hour by default
	}
}

// getListKey generates a cache key for a list of objects
func getListKey(userID uuid.UUID, isAdmin bool, objType string) string {
	role := "user"
	if isAdmin {
		role = "admin"
	}
	t := "all"
	if objType != "" {
		t = objType
	}
	return fmt.Sprintf("geo_objects:list:%s:%s:%s", role, userID.String(), t)
}

// GetList retrieves a cached list of geo objects
func (c *RedisCache) GetList(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string) ([]model.GeoObjectWithGeometry, error) {
	key := getListKey(userID, isAdmin, objType)
	
	val, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	} else if err != nil {
		log.Printf("[ERROR] Redis Get error for key %s: %v", key, err)
		return nil, err
	}

	var objects []model.GeoObjectWithGeometry
	if err := json.Unmarshal([]byte(val), &objects); err != nil {
		log.Printf("[ERROR] Redis unmarshal error for key %s: %v", key, err)
		return nil, err
	}

	log.Printf("[DEBUG] Cache hit for key %s (%d objects)", key, len(objects))
	return objects, nil
}

// SetList caches a list of geo objects
func (c *RedisCache) SetList(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, objects []model.GeoObjectWithGeometry) error {
	key := getListKey(userID, isAdmin, objType)
	
	data, err := json.Marshal(objects)
	if err != nil {
		log.Printf("[ERROR] Redis marshal error for key %s: %v", key, err)
		return err
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		log.Printf("[ERROR] Redis Set error for key %s: %v", key, err)
		return err
	}

	log.Printf("[DEBUG] Cache set for key %s (%d objects)", key, len(objects))
	return nil
}

// InvalidateLists clears all cached lists. Since objects can be global,
// an update by one user might affect what other users see. 
// For simplicity in this implementation, we invalidate all `geo_objects:list:*` keys.
func (c *RedisCache) InvalidateLists(ctx context.Context) error {
	var cursor uint64
	var err error
	var keys []string

	for {
		var batch []string
		batch, cursor, err = c.client.Scan(ctx, cursor, "geo_objects:*", 100).Result()
		if err != nil {
			log.Printf("[ERROR] Redis Scan error during invalidation: %v", err)
			return err
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			break
		}
	}

	if len(keys) > 0 {
		if err := c.client.Del(ctx, keys...).Err(); err != nil {
			log.Printf("[ERROR] Redis Del error during invalidation: %v", err)
			return err
		}
		log.Printf("[INFO] Cache invalidated %d list keys", len(keys))
	}
	
	return nil
}

// getBBoxKey generates a cache key for a bbox query.
// Coordinates are rounded to a grid (0.5 degree) for cache reuse across similar viewports.
func getBBoxKey(zoom int, minLat, minLng, maxLat, maxLng float64, objType string, filterByZoom bool) string {
	// Round to 0.5 degree grid for cache reuse
	round := func(v float64) float64 {
		return math.Round(v*2) / 2
	}
	filter := "all"
	if objType != "" {
		filter = objType
	}
	zf := "nozf"
	if filterByZoom {
		zf = "zf"
	}
	return fmt.Sprintf("geo_objects:bbox:%d:%.1f:%.1f:%.1f:%.1f:%s:%s",
		zoom, round(minLat), round(minLng), round(maxLat), round(maxLng), filter, zf)
}

// GetBBox retrieves cached bbox query results
func (c *RedisCache) GetBBox(ctx context.Context, zoom int, minLat, minLng, maxLat, maxLng float64, objType string, filterByZoom bool) ([]model.GeoObjectWithGeometry, error) {
	key := getBBoxKey(zoom, minLat, minLng, maxLat, maxLng, objType, filterByZoom)

	val, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	var objects []model.GeoObjectWithGeometry
	if err := json.Unmarshal([]byte(val), &objects); err != nil {
		return nil, err
	}

	return objects, nil
}

// SetBBox caches bbox query results with a shorter TTL (5 minutes)
func (c *RedisCache) SetBBox(ctx context.Context, zoom int, minLat, minLng, maxLat, maxLng float64, objType string, filterByZoom bool, objects []model.GeoObjectWithGeometry) error {
	key := getBBoxKey(zoom, minLat, minLng, maxLat, maxLng, objType, filterByZoom)

	data, err := json.Marshal(objects)
	if err != nil {
		return err
	}

	return c.client.Set(ctx, key, data, 5*time.Minute).Err()
}

// Close closes the Redis client connection
func (c *RedisCache) Close() error {
	return c.client.Close()
}
