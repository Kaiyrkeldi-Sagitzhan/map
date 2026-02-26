package main

import (
	"fmt"
	"log"

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

	// Connect to database
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database successfully")

	// Initialize repository
	geoObjectRepository := repository.NewGeoObjectRepository(db)

	// Initialize Redis cache
	redisCache := repository.NewRedisCache(cfg.RedisURL)
	defer redisCache.Close()

	// Initialize service
	geoObjectService := service.NewGeoObjectService(geoObjectRepository, redisCache)

	// Initialize handler
	geoObjectHandler := handler.NewGeoObjectHandler(geoObjectService)

	// Setup Gin router
	router := gin.Default()

	// Add CORS middleware
	router.Use(middleware.CORSMiddleware())

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
		}
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Map Service on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
