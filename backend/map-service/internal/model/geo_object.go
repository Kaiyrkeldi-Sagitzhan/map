package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObject represents a geographic object in the system
type GeoObject struct {
	ID          string          `json:"id" db:"id"`
	BaseID      uuid.UUID       `json:"base_id" db:"base_id"`
	Version     int             `json:"version" db:"version"`
	OwnerID     *uuid.UUID      `json:"owner_id,omitempty" db:"owner_id"`
	Scope       string          `json:"scope" db:"scope"`
	Type        string          `json:"type" db:"type"`
	Name        string          `json:"name" db:"name"`
	Description string          `json:"description,omitempty" db:"description"`
	Metadata    json.RawMessage `json:"metadata,omitempty" db:"metadata"`
	Geometry    interface{}     `json:"geometry" db:"geometry"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

// ObjectScope constants
const (
	ScopeGlobal  = "global"
	ScopePrivate = "private"
)

// ObjectType constants
const (
	TypeRiver      = "river"
	TypeLake       = "lake"
	TypeMountain   = "mountain"
	TypeRegion     = "region"
	TypeCity       = "city"
	TypeRoad       = "road"
	TypeBoundary   = "boundary"
	TypeForest     = "forest"
	TypeRelief     = "relief"
	TypeBuilding   = "building"
	TypeCustom     = "custom"
	TypeOther      = "other"
)

// ValidScopes returns all valid scope values
func ValidScopes() []string {
	return []string{ScopeGlobal, ScopePrivate}
}

// ValidTypes returns all valid object type values
func ValidTypes() []string {
	return []string{TypeRiver, TypeLake, TypeMountain, TypeRegion, TypeCity, TypeRoad, TypeBoundary, TypeForest, TypeRelief, TypeBuilding, TypeCustom, TypeOther}
}

// IsValidScope checks if the scope is valid
func IsValidScope(scope string) bool {
	for _, s := range ValidScopes() {
		if s == scope {
			return true
		}
	}
	return false
}

// IsValidType checks if the type is valid
func IsValidType(objType string) bool {
	for _, t := range ValidTypes() {
		if t == objType {
			return true
		}
	}
	return false
}

// GeoObjectWithGeometry represents a geo object with parsed geometry
type GeoObjectWithGeometry struct {
	ID          string          `json:"id"`
	BaseID      uuid.UUID       `json:"base_id"`
	Version     int             `json:"version"`
	OwnerID     *uuid.UUID      `json:"owner_id,omitempty"`
	Scope       string          `json:"scope"`
	Type        string          `json:"type"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Geometry    json.RawMessage `json:"geometry"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}
