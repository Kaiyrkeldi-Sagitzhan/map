package middleware

import (
	"net/http"
	"strings"

	"auth-service/internal/dto"
	"auth-service/pkg/jwt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Context keys
const (
	ContextKeyUserID = "user_id"
	ContextKeyEmail  = "email"
	ContextKeyRole   = "role"
)

// JWTAuth creates a JWT authentication middleware
func JWTAuth(tokenManager *jwt.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "unauthorized",
				Message: "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "unauthorized",
				Message: "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := tokenManager.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "unauthorized",
				Message: "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set(ContextKeyUserID, claims.UserID)
		c.Set(ContextKeyEmail, claims.Email)
		c.Set(ContextKeyRole, claims.Role)

		c.Next()
	}
}

// GetUserID retrieves the user ID from the context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get(ContextKeyUserID)
	if !exists {
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

// GetUserEmail retrieves the user email from the context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(ContextKeyEmail)
	if !exists {
		return "", false
	}
	return email.(string), true
}

// GetUserRole retrieves the user role from the context
func GetUserRole(c *gin.Context) (string, bool) {
	role, exists := c.Get(ContextKeyRole)
	if !exists {
		return "", false
	}
	return role.(string), true
}

// AdminOnly creates an admin-only middleware
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := GetUserRole(c)
		if !exists || role != "admin" {
			c.JSON(http.StatusForbidden, dto.ErrorResponse{
				Error:   "forbidden",
				Message: "Admin access required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// OwnerOrAdmin creates a middleware that allows access if user is owner or admin
func OwnerOrAdmin(objectOwnerID uuid.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := GetUserID(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
				Error:   "unauthorized",
				Message: "User not authenticated",
			})
			c.Abort()
			return
		}

		role, _ := GetUserRole(c)

		// Allow if user is admin or owner
		if role != "admin" && userID != objectOwnerID {
			c.JSON(http.StatusForbidden, dto.ErrorResponse{
				Error:   "forbidden",
				Message: "You don't have permission to access this resource",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// CORSMiddleware creates a CORS middleware
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
