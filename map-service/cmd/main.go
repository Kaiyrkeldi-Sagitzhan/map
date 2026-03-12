package main

import (
	"fmt"
	"log"
	"time"

	"map-service/internal/config"
	"map-service/internal/handler"
	"map-service/internal/middleware"
	"map-service/internal/repository"
	"map-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database with retry
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)

	var db *sqlx.DB
	var err error
	maxRetries := 5
	for i := 0; i < maxRetries; i++ {
		db, err = sqlx.Connect("postgres", dsn)
		if err == nil {
			if pingErr := db.Ping(); pingErr == nil {
				break
			} else {
				db.Close()
				err = pingErr
			}
		}
		if i < maxRetries-1 {
			wait := time.Duration(1<<uint(i)) * time.Second // 1s, 2s, 4s, 8s
			log.Printf("Failed to connect to database (attempt %d/%d): %v. Retrying in %v...", i+1, maxRetries, err, wait)
			time.Sleep(wait)
		}
	}
	if err != nil {
		log.Fatalf("Failed to connect to database after %d attempts: %v", maxRetries, err)
	}
	defer db.Close()
	log.Println("Connected to database successfully")

	// Initialize repository
	geoObjectRepository := repository.NewGeoObjectRepository(db)
	geoObjectHistoryRepository := repository.NewGeoObjectHistoryRepository(db)

	// Initialize Redis cache
	redisCache := repository.NewRedisCache(cfg.RedisURL)
	defer redisCache.Close()

	// Initialize service
	geoObjectService := service.NewGeoObjectService(geoObjectRepository, geoObjectHistoryRepository, redisCache)
	geoObjectHistoryService := service.NewGeoObjectHistoryService(geoObjectHistoryRepository, geoObjectRepository)

	// Initialize handler
	geoObjectHandler := handler.NewGeoObjectHandler(geoObjectService)
	geoObjectHistoryHandler := handler.NewGeoObjectHistoryHandler(geoObjectHistoryService)

	// Setup Gin router
	router := gin.Default()

	// Health check
	router.GET("/health", geoObjectHandler.HealthCheck)

	// API routes
	api := router.Group("/api")
	{
		mapGroup := api.Group("/map")
		mapGroup.Use(middleware.JWTAuth(cfg.JWTSecret))
		{
			mapGroup.POST("/objects", geoObjectHandler.Create)
			mapGroup.GET("/objects", geoObjectHandler.GetAll)
			mapGroup.GET("/objects/:id", geoObjectHandler.GetByID)
			mapGroup.PUT("/objects/:id", geoObjectHandler.Update)
			mapGroup.DELETE("/objects/:id", geoObjectHandler.Delete)
			mapGroup.GET("/tiles/:z/:x/:y.pbf", geoObjectHandler.GetTile)

			// History routes
			mapGroup.GET("/objects/:id/history", geoObjectHistoryHandler.GetByObjectID)
			mapGroup.POST("/history/:historyId/rollback", geoObjectHistoryHandler.Rollback)
		}
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Map Service on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
