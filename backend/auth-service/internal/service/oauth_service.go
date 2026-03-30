package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repository"

	"github.com/google/uuid"
)

// GoogleOAuthService handles Google OAuth flow
type GoogleOAuthService struct {
	clientID            string
	clientSecret        string
	defaultRedirectURL  string
	allowedRedirectURLs map[string]struct{}
	userRepo            *repository.UserRepository
	tokenManager        interface {
		GenerateToken(userID uuid.UUID, email, role string) (string, error)
	}
}

// NewGoogleOAuthService creates a new Google OAuth service
func NewGoogleOAuthService(clientID, clientSecret, redirectURL string, allowedRedirectURLs []string, userRepo *repository.UserRepository, tokenMgr interface {
	GenerateToken(userID uuid.UUID, email, role string) (string, error)
}) *GoogleOAuthService {
	allowed := make(map[string]struct{})
	for _, rawURL := range allowedRedirectURLs {
		normalized, ok := normalizeRedirectURL(rawURL)
		if ok {
			allowed[normalized] = struct{}{}
		}
	}

	normalizedDefault, ok := normalizeRedirectURL(redirectURL)
	if !ok {
		normalizedDefault = "http://localhost:3000/auth/google/callback"
	}
	allowed[normalizedDefault] = struct{}{}

	return &GoogleOAuthService{
		clientID:            clientID,
		clientSecret:        clientSecret,
		defaultRedirectURL:  normalizedDefault,
		allowedRedirectURLs: allowed,
		userRepo:            userRepo,
		tokenManager:        tokenMgr,
	}
}

// GetAuthURL returns the Google OAuth URL
func (s *GoogleOAuthService) GetAuthURL(state string, redirectURL string) string {
	resolvedRedirectURL := s.resolveRedirectURL(redirectURL)
	return fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=email%%20profile&state=%s&access_type=offline",
		s.clientID,
		resolvedRedirectURL,
		state,
	)
}

// ExchangeCode exchanges the authorization code for tokens
func (s *GoogleOAuthService) ExchangeCode(ctx context.Context, code string, redirectURL string) (*googleTokenResponse, error) {
	data := fmt.Sprintf(
		"code=%s&client_id=%s&client_secret=%s&redirect_uri=%s&grant_type=authorization_code",
		code,
		s.clientID,
		s.clientSecret,
		redirectURL,
	)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token", strings.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to exchange code: %s", string(body))
	}

	var tokenResp googleTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// GetUserInfo retrieves user info from Google
func (s *GoogleOAuthService) GetUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to get user info: %s", string(body))
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// GoogleUserInfo represents Google's user info response
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// HandleGoogleCallback handles the OAuth callback and creates/updates user
func (s *GoogleOAuthService) HandleGoogleCallback(ctx context.Context, code string, redirectURL string) (*dto.AuthResponse, error) {
	resolvedRedirectURL := s.resolveRedirectURL(redirectURL)

	// Exchange code for token
	token, err := s.ExchangeCode(ctx, code, resolvedRedirectURL)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	// Get user info
	userInfo, err := s.GetUserInfo(ctx, token.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	// Check if user exists
	user, err := s.userRepo.GetByEmail(ctx, userInfo.Email)
	if err != nil {
		if err == repository.ErrUserNotFound {
			// Create new user with 'user' role
			user = &model.User{
				ID:        uuid.New(),
				Email:     userInfo.Email,
				Role:      model.RoleUser,
				FirstName: userInfo.Name,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			if err := s.userRepo.Create(ctx, user); err != nil {
				return nil, fmt.Errorf("failed to create user: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to get user: %w", err)
		}
	}

	// Generate JWT token
	jwtToken, err := s.tokenManager.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &dto.AuthResponse{
		Token: jwtToken,
		User: dto.UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			Role:      user.Role,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Nickname:  user.Nickname,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		},
	}, nil
}

func (s *GoogleOAuthService) resolveRedirectURL(candidate string) string {
	normalized, ok := normalizeRedirectURL(candidate)
	if ok {
		if _, exists := s.allowedRedirectURLs[normalized]; exists {
			return normalized
		}
	}

	return s.defaultRedirectURL
}

func normalizeRedirectURL(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", false
	}
	if parsed.Host == "" || parsed.Path == "" {
		return "", false
	}

	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/"), true
}

// parseJWT parses a JWT token without verification (for getting claims)
func parseJWT(token string) (map[string]interface{}, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	payload := parts[1]
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}

	payload = strings.ReplaceAll(payload, "-", "+")
	payload = strings.ReplaceAll(payload, "_", "/")

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, err
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return nil, err
	}

	return claims, nil
}

// VerifyGoogleToken verifies a Google ID token
func (s *GoogleOAuthService) VerifyGoogleToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	claims, err := parseJWT(idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JWT: %w", err)
	}

	email, ok := claims["email"].(string)
	if !ok {
		return nil, fmt.Errorf("email not found in token")
	}

	verified, _ := claims["email_verified"].(bool)
	name, _ := claims["name"].(string)
	sub, _ := claims["sub"].(string)
	picture, _ := claims["picture"].(string)

	return &GoogleUserInfo{
		ID:            sub,
		Email:         email,
		VerifiedEmail: verified,
		Name:          name,
		Picture:       picture,
	}, nil
}
