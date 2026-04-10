package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObjectVersionResponse represents a version entry sent to the client
type GeoObjectVersionResponse struct {
	ID          uuid.UUID       `json:"id"`
	GeoObjectID string          `json:"geoObjectId"`
	Version     int             `json:"version"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Geometry    interface{}     `json:"geometry"`
	CreatedAt   time.Time       `json:"createdAt"`
	CreatedBy   *uuid.UUID      `json:"createdBy,omitempty"`
}

// CreateGeoObjectVersionRequest represents a request to create a new version
type CreateGeoObjectVersionRequest struct {
	GeoObjectID string          `json:"geoObjectId"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Geometry    interface{}     `json:"geometry"`
}

// RollbackToVersionRequest represents a request to rollback to a specific version
type RollbackToVersionRequest struct {
	Version int `json:"version" binding:"required,min=1"`
}
