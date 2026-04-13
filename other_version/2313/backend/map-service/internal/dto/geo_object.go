package dto

import (
	"encoding/json"

	"github.com/google/uuid"
)

// CreateGeoObjectRequest represents the request to create a geo object

type CreateGeoObjectRequest struct {
	Scope       string          `json:"scope" binding:"required,oneof=global private"`
	Type        string          `json:"type" binding:"required"`
	Name        string          `json:"name" binding:"required,min=1,max=255"`
	Description string          `json:"description"`
	Metadata    json.RawMessage `json:"metadata"`
	Geometry    json.RawMessage `json:"geometry" binding:"required"`
}

// UpdateGeoObjectRequest represents the request to update a geo object
type UpdateGeoObjectRequest struct {
	Scope       string          `json:"scope,omitempty"`
	Type        string          `json:"type,omitempty"`
	Name        string          `json:"name,omitempty" binding:"omitempty,min=1,max=255"`
	Description string          `json:"description,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Geometry    json.RawMessage `json:"geometry,omitempty"`
}

// GeoObjectResponse represents a geo object response
type GeoObjectResponse struct {
	ID          uuid.UUID       `json:"id"`
	OwnerID     *uuid.UUID      `json:"owner_id,omitempty"`
	Scope       string          `json:"scope"`
	Type        string          `json:"type"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Geometry    json.RawMessage `json:"geometry"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

// GeoObjectListResponse represents a list of geo objects
type GeoObjectListResponse struct {
	Objects []GeoObjectResponse `json:"objects"`
	Total   int                 `json:"total"`
}

// GeoObjectFilter represents filters for querying geo objects
type GeoObjectFilter struct {
	Scope string   `form:"scope"`
	Types []string `form:"types"`
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
