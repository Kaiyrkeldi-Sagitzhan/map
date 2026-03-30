package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds the application configuration
type Config struct {
	Port           string
	DBHost         string
	DBPort         int
	DBName         string
	DBUser         string
	DBPassword     string
	JWTSecret      string
	JWTExpiryHours int
	// Email verification
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
	// Google OAuth
	GoogleClientID            string
	GoogleClientSecret        string
	GoogleRedirectURL         string
	GoogleAllowedRedirectURLs []string
}

// Load loads configuration from environment variables
func Load() *Config {
	defaultGoogleRedirectURL := getEnv("GOOGLE_REDIRECT_URL", "http://localhost:3000/auth/google/callback")
	googleAllowedRedirectURLs := parseCommaSeparatedURLs(getEnv("GOOGLE_ALLOWED_REDIRECT_URLS", ""))

	if len(googleAllowedRedirectURLs) == 0 {
		googleAllowedRedirectURLs = []string{
			defaultGoogleRedirectURL,
			"http://localhost:3000/auth/google/callback",
			"http://localhost:5173/auth/google/callback",
			"http://localhost:8080/auth/google/callback",
		}
	}

	if !containsString(googleAllowedRedirectURLs, defaultGoogleRedirectURL) {
		googleAllowedRedirectURLs = append(googleAllowedRedirectURLs, defaultGoogleRedirectURL)
	}

	return &Config{
		Port:           getEnv("PORT", "8081"),
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnvAsInt("DB_PORT", 5432),
		DBName:         getEnv("DB_NAME", "kzmap"),
		DBUser:         getEnv("DB_USER", "kzmap_user"),
		DBPassword:     getEnv("DB_PASSWORD", "kzmap_password"),
		JWTSecret:      getEnv("JWT_SECRET", "kazakhstan-map-secret-key-2024"),
		JWTExpiryHours: getEnvAsInt("JWT_EXPIRY_HOURS", 24),
		// Email verification
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnvAsInt("SMTP_PORT", 587),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", "noreply@freshmap.team"),
		// Google OAuth
		GoogleClientID:            getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:        getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:         defaultGoogleRedirectURL,
		GoogleAllowedRedirectURLs: googleAllowedRedirectURLs,
	}
}

func parseCommaSeparatedURLs(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		if !containsString(result, item) {
			result = append(result, item)
		}
	}

	return result
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
