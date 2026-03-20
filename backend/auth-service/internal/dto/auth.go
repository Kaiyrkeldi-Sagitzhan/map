package dto

import (
	"github.com/google/uuid"
)

// RegisterRequest represents the registration request
type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	Role      string `json:"role"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
}

// LoginRequest represents the login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

// UserDTO represents the user data transfer object
type UserDTO struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Nickname  string    `json:"nickname"`
	CreatedAt string    `json:"created_at"`
}

// RefreshTokenRequest represents the token refresh request
type RefreshTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// UpdateProfileRequest represents updating own profile
type UpdateProfileRequest struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	Nickname        string `json:"nickname"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// AdminCreateUserRequest represents admin creating a user
type AdminCreateUserRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	Role      string `json:"role" binding:"required"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
}

// AdminUpdateUserRequest represents admin updating a user
type AdminUpdateUserRequest struct {
	Email     string `json:"email"`
	Role      string `json:"role"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
	Password  string `json:"password"`
}

// UserListResponse represents paginated user list
type UserListResponse struct {
	Users []UserDTO `json:"users"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// SendVerificationCodeRequest represents the request to send verification code
type SendVerificationCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerifyCodeRequest represents the request to verify code
type VerifyCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

// GoogleOAuthURLResponse represents the Google OAuth URL response
type GoogleOAuthURLResponse struct {
	URL string `json:"url"`
}

// GoogleCallbackRequest represents the Google OAuth callback
type GoogleCallbackRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
}
