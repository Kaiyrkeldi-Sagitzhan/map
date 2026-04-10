package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObjectVersion represents a versioned snapshot of a geo object
type GeoObjectVersion struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	GeoObjectID uuid.UUID       `json:"geo_object_id" db:"geo_object_id"`
	Version     int             `json:"version" db:"version"`
	Name        string          `json:"name" db:"name"`
	Description string          `json:"description,omitempty" db:"description"`
	Metadata    json.RawMessage `json:"metadata,omitempty" db:"metadata"`
	Geometry    string          `json:"geometry" db:"geometry"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	CreatedBy   *uuid.UUID      `json:"created_by,omitempty" db:"created_by"`
}
