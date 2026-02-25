package service

import (
	"context"
	"errors"
	"time"

	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repository"
	"auth-service/pkg/jwt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidRole        = errors.New("invalid role")
)

// AuthService handles authentication business logic
type AuthService struct {
	userRepository *repository.UserRepository
	tokenManager    *jwt.TokenManager
}

// NewAuthService creates a new AuthService instance
func NewAuthService(userRepo *repository.UserRepository, tokenManager *jwt.TokenManager) *AuthService {
	return &AuthService{
		userRepository: userRepo,
		tokenManager:    tokenManager,
	}
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error) {
	// Validate role
	role := req.Role
	if role == "" {
		role = model.RoleUser
	} else if !model.IsValidRole(role) {
		return nil, ErrInvalidRole
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	now := time.Now()
	user := &model.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         role,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Save to database
	err = s.userRepository.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	// Generate JWT token
	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User: dto.UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		},
	}, nil
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(ctx context.Context, req *dto.LoginRequest) (*dto.AuthResponse, error) {
	// Find user by email
	user, err := s.userRepository.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Generate JWT token
	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User: dto.UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		},
	}, nil
}

// ValidateToken validates a JWT token and returns the user claims
func (s *AuthService) ValidateToken(ctx context.Context, tokenString string) (*jwt.Claims, error) {
	return s.tokenManager.ValidateToken(tokenString)
}

// RefreshToken refreshes an existing JWT token
func (s *AuthService) RefreshToken(ctx context.Context, tokenString string) (*dto.AuthResponse, error) {
	claims, err := s.tokenManager.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	// Get user by ID
	user, err := s.userRepository.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}

	// Generate new token
	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User: dto.UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		},
	}, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, userID uuid.UUID) (*dto.UserDTO, error) {
	user, err := s.userRepository.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &dto.UserDTO{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
	}, nil
}
