package main

import (
	"fmt"
	"log"

	"auth-service/internal/config"
	"auth-service/internal/handler"
	"auth-service/internal/middleware"
	"auth-service/internal/repository"
	"auth-service/internal/service"
	"auth-service/pkg/jwt"

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

	// Initialize JWT token manager
	tokenManager := jwt.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiryHours)

	// Initialize repository
	userRepository := repository.NewUserRepository(db)

	// Initialize service
	authService := service.NewAuthService(userRepository, tokenManager)

	// Initialize handler
	authHandler := handler.NewAuthHandler(authService)

	// Setup Gin router
	router := gin.Default()

	// Add CORS middleware
	router.Use(middleware.CORSMiddleware())

	// Health check
	router.GET("/health", authHandler.HealthCheck)

	// API routes
	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
		}

		// Protected routes
		protected := api.Group("/auth")
		protected.Use(middleware.JWTAuth(tokenManager))
		{
			protected.GET("/me", authHandler.GetCurrentUser)
		}
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Auth Service on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
