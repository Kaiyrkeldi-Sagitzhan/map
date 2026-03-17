package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/dto"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler handles HTTP requests for authentication
type AuthHandler struct {
	authService     *service.AuthService
	verificationSvc *service.VerificationService
	googleOAuthSvc  *service.GoogleOAuthService
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(authService *service.AuthService, verificationSvc *service.VerificationService, googleOAuthSvc *service.GoogleOAuthService) *AuthHandler {
	return &AuthHandler{
		authService:     authService,
		verificationSvc: verificationSvc,
		googleOAuthSvc:  googleOAuthSvc,
	}
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

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		// Try string conversion
		userIDStr, ok := userID.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Error:   "internal_error",
				Message: "Invalid user ID format",
			})
			return
		}
		var err error
		userUUID, err = uuid.Parse(userIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
				Error:   "internal_error",
				Message: "Failed to parse user ID",
			})
			return
		}
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

// UpdateMyProfile updates the current user's profile
func (h *AuthHandler) UpdateMyProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
		})
		return
	}

	userUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Invalid user ID format",
		})
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	user, err := h.authService.UpdateProfile(c.Request.Context(), userUUID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := err.Error()

		switch err.Error() {
		case "invalid credentials":
			status = http.StatusUnauthorized
			errorMsg = "unauthorized"
			message = "Current password is incorrect"
		case "current password required":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
			message = "Current password is required to change password"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// ListUsers returns paginated user list (admin only)
func (h *AuthHandler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.authService.ListUsers(c.Request.Context(), search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to list users",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// AdminCreateUser creates a new user (admin only)
func (h *AuthHandler) AdminCreateUser(c *gin.Context) {
	var req dto.AdminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	user, err := h.authService.AdminCreateUser(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := err.Error()

		switch err.Error() {
		case "user already exists":
			status = http.StatusConflict
			errorMsg = "conflict"
			message = "User with this email already exists"
		case "invalid role":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// AdminUpdateUser updates a user (admin only)
func (h *AuthHandler) AdminUpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid user ID",
		})
		return
	}

	var req dto.AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	user, err := h.authService.AdminUpdateUser(c.Request.Context(), userID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := err.Error()

		switch err.Error() {
		case "user not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		case "invalid role":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// AdminDeleteUser deletes a user (admin only)
func (h *AuthHandler) AdminDeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid user ID",
		})
		return
	}

	err = h.authService.AdminDeleteUser(c.Request.Context(), userID)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := err.Error()

		switch err.Error() {
		case "user not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "User deleted successfully",
	})
}

// ImpersonateUser generates a token for a target user (admin only)
func (h *AuthHandler) ImpersonateUser(c *gin.Context) {
	idStr := c.Param("id")
	targetID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid user ID",
		})
		return
	}

	resp, err := h.authService.ImpersonateUser(c.Request.Context(), targetID)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := err.Error()

		switch err.Error() {
		case "user not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// SendVerificationCode sends a verification code to the user's email
func (h *AuthHandler) SendVerificationCode(c *gin.Context) {
	var req dto.SendVerificationCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	err := h.verificationSvc.SendVerificationCode(c.Request.Context(), req.Email)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"
		message := "Failed to send verification code"

		switch err.Error() {
		case "too many verification attempts":
			status = http.StatusTooManyRequests
			errorMsg = "rate_limit_exceeded"
			message = "Too many attempts. Please try again later."
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Verification code sent",
	})
}

// VerifyCode verifies the user's email with the code
func (h *AuthHandler) VerifyCode(c *gin.Context) {
	var req dto.VerifyCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	err := h.verificationSvc.VerifyCode(c.Request.Context(), req.Email, req.Code)
	if err != nil {
		status := http.StatusBadRequest
		errorMsg := "invalid_code"
		message := "Invalid or expired verification code"

		switch err.Error() {
		case "verification code expired":
			errorMsg = "code_expired"
			message = "Verification code has expired"
		case "too many verification attempts":
			status = http.StatusTooManyRequests
			errorMsg = "rate_limit_exceeded"
			message = "Too many attempts. Please request a new code."
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: message,
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Email verified successfully",
	})
}

// GetGoogleAuthURL returns the Google OAuth URL
func (h *AuthHandler) GetGoogleAuthURL(c *gin.Context) {
	state := "google_oauth"
	url := h.googleOAuthSvc.GetAuthURL(state)
	c.JSON(http.StatusOK, dto.GoogleOAuthURLResponse{
		URL: url,
	})
}

// GoogleCallback handles the Google OAuth callback
func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Missing code parameter",
		})
		return
	}

	resp, err := h.googleOAuthSvc.HandleGoogleCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "oauth_error",
			Message: "Failed to complete Google authentication",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// HealthCheck returns the health status of the service
func (h *AuthHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "auth-service",
	})
}
