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
	tokenManager   *jwt.TokenManager
}

// NewAuthService creates a new AuthService instance
func NewAuthService(userRepo *repository.UserRepository, tokenManager *jwt.TokenManager) *AuthService {
	return &AuthService{
		userRepository: userRepo,
		tokenManager:   tokenManager,
	}
}

func userToDTO(user *model.User) dto.UserDTO {
	return dto.UserDTO{
		ID:        user.ID,
		Email:     user.Email,
		Role:      user.Role,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Nickname:  user.Nickname,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
	}
}

// Register creates a new user account
func (s *AuthService) Register(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error) {
	role := req.Role
	if role == "" {
		role = model.RoleUser
	} else if !model.IsValidRole(role) {
		return nil, ErrInvalidRole
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := &model.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         role,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Nickname:     req.Nickname,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	err = s.userRepository.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  userToDTO(user),
	}, nil
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(ctx context.Context, req *dto.LoginRequest) (*dto.AuthResponse, error) {
	user, err := s.userRepository.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  userToDTO(user),
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

	user, err := s.userRepository.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}

	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  userToDTO(user),
	}, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, userID uuid.UUID) (*dto.UserDTO, error) {
	user, err := s.userRepository.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := userToDTO(user)
	return &result, nil
}

// UpdateProfile updates the current user's profile
func (s *AuthService) UpdateProfile(ctx context.Context, userID uuid.UUID, req *dto.UpdateProfileRequest) (*dto.UserDTO, error) {
	user, err := s.userRepository.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Update password if requested
	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			return nil, errors.New("current password required")
		}
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword))
		if err != nil {
			return nil, ErrInvalidCredentials
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		user.PasswordHash = string(hashedPassword)
	}

	// Update profile fields
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}

	user.UpdatedAt = time.Now()

	err = s.userRepository.Update(ctx, user)
	if err != nil {
		return nil, err
	}

	result := userToDTO(user)
	return &result, nil
}

// ListUsers returns paginated user list (admin only)
func (s *AuthService) ListUsers(ctx context.Context, search string, page, limit int) (*dto.UserListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	users, err := s.userRepository.ListUsers(ctx, search, page, limit)
	if err != nil {
		return nil, err
	}

	total, err := s.userRepository.CountUsers(ctx, search)
	if err != nil {
		return nil, err
	}

	userDTOs := make([]dto.UserDTO, len(users))
	for i, u := range users {
		userDTOs[i] = userToDTO(&u)
	}

	return &dto.UserListResponse{
		Users: userDTOs,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// AdminCreateUser creates a new user (admin only)
func (s *AuthService) AdminCreateUser(ctx context.Context, req *dto.AdminCreateUserRequest) (*dto.UserDTO, error) {
	if !model.IsValidRole(req.Role) {
		return nil, ErrInvalidRole
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := &model.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         req.Role,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Nickname:     req.Nickname,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	err = s.userRepository.Create(ctx, user)
	if err != nil {
		return nil, err
	}

	result := userToDTO(user)
	return &result, nil
}

// AdminUpdateUser updates any user (admin only)
func (s *AuthService) AdminUpdateUser(ctx context.Context, userID uuid.UUID, req *dto.AdminUpdateUserRequest) (*dto.UserDTO, error) {
	user, err := s.userRepository.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Role != "" {
		if !model.IsValidRole(req.Role) {
			return nil, ErrInvalidRole
		}
		user.Role = req.Role
	}
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		user.PasswordHash = string(hashedPassword)
	}

	user.UpdatedAt = time.Now()

	err = s.userRepository.Update(ctx, user)
	if err != nil {
		return nil, err
	}

	result := userToDTO(user)
	return &result, nil
}

// AdminDeleteUser deletes a user (admin only)
func (s *AuthService) AdminDeleteUser(ctx context.Context, userID uuid.UUID) error {
	return s.userRepository.Delete(ctx, userID)
}

// ImpersonateUser generates a token for the target user (admin only)
func (s *AuthService) ImpersonateUser(ctx context.Context, targetUserID uuid.UUID) (*dto.AuthResponse, error) {
	user, err := s.userRepository.GetByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	token, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		Token: token,
		User:  userToDTO(user),
	}, nil
}
