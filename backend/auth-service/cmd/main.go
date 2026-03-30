package main

import (
	"fmt"
	"log"
	"time"

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

	// Initialize JWT token manager
	tokenManager := jwt.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiryHours)

	// Initialize repository
	userRepository := repository.NewUserRepository(db)

	// Initialize services
	authService := service.NewAuthService(userRepository, tokenManager)

	// Email service
	emailService := service.NewEmailService(
		cfg.SMTPHost,
		cfg.SMTPPort,
		cfg.SMTPUsername,
		cfg.SMTPPassword,
		cfg.SMTPFrom,
	)

	// Verification service
	verificationService := service.NewVerificationService(emailService)

	// Google OAuth service
	googleOAuthService := service.NewGoogleOAuthService(
		cfg.GoogleClientID,
		cfg.GoogleClientSecret,
		cfg.GoogleRedirectURL,
		cfg.GoogleAllowedRedirectURLs,
		userRepository,
		tokenManager,
	)

	// Initialize handler
	authHandler := handler.NewAuthHandler(authService, verificationService, googleOAuthService)

	// Setup Gin router
	router := gin.Default()

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
			// Email verification
			auth.POST("/verify/send", authHandler.SendVerificationCode)
			auth.POST("/verify", authHandler.VerifyCode)
			// Google OAuth
			auth.GET("/google/url", authHandler.GetGoogleAuthURL)
			auth.GET("/google/callback", authHandler.GoogleCallback)
		}

		// Protected routes (any authenticated user)
		protected := api.Group("/auth")
		protected.Use(middleware.JWTAuth(tokenManager))
		{
			protected.GET("/me", authHandler.GetCurrentUser)
			protected.PUT("/me", authHandler.UpdateMyProfile)
		}

		// Admin-only routes
		admin := api.Group("/auth")
		admin.Use(middleware.JWTAuth(tokenManager), middleware.AdminOnly())
		{
			admin.GET("/users", authHandler.ListUsers)
			admin.POST("/users", authHandler.AdminCreateUser)
			admin.PUT("/users/:id", authHandler.AdminUpdateUser)
			admin.DELETE("/users/:id", authHandler.AdminDeleteUser)
			admin.POST("/users/:id/impersonate", authHandler.ImpersonateUser)
		}
	}

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Auth Service on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
