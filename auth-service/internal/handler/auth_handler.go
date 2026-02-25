package handler

import (
	"net/http"

	"auth-service/internal/dto"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler handles HTTP requests for authentication
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := "An error occurred during registration"

		switch err.Error() {
		case "user already exists":
			status = http.StatusConflict
			errorMsg = "conflict"
			message = "User with this email already exists"
		case "invalid role":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
			message = "Invalid role specified"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := "An error occurred during login"

		switch err.Error() {
		case "invalid credentials":
			status = http.StatusUnauthorized
			errorMsg = "unauthorized"
			message = "Invalid email or password"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req dto.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.authService.RefreshToken(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or expired token",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetCurrentUser returns the current authenticated user
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
		})
		return
	}

	// Convert to UUID
	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Invalid user ID format",
		})
		return
	}

	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to parse user ID",
		})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get user information",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// HealthCheck returns the health status of the service
func (h *AuthHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"service": "auth-service",
	})
}
