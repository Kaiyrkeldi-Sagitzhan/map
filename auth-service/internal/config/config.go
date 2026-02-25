package config

import (
	"os"
	"strconv"
)

// Config holds the application configuration
type Config struct {
	Port          string
	DBHost        string
	DBPort        int
	DBName        string
	DBUser        string
	DBPassword    string
	JWTSecret     string
	JWTExpiryHours int
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "8081"),
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBPort:        getEnvAsInt("DB_PORT", 5432),
		DBName:        getEnv("DB_NAME", "kzmap"),
		DBUser:        getEnv("DB_USER", "kzmap_user"),
		DBPassword:    getEnv("DB_PASSWORD", "kzmap_password"),
		JWTSecret:     getEnv("JWT_SECRET", "kazakhstan-map-secret-key-2024"),
		JWTExpiryHours: getEnvAsInt("JWT_EXPIRY_HOURS", 24),
	}
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
