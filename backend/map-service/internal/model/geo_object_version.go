package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObjectVersion represents a version snapshot of a geo object
type GeoObjectVersion struct {
	ID                uuid.UUID       `json:"id" db:"id"`
	ObjectID          uuid.UUID       `json:"object_id" db:"object_id"`
	VersionNumber     int             `json:"version_number" db:"version_number"`
	Snapshot          json.RawMessage `json:"snapshot" db:"snapshot"`
	ChangeDescription string          `json:"change_description,omitempty" db:"change_description"`
	CreatedBy         *uuid.UUID      `json:"created_by,omitempty" db:"created_by"`
	CreatedAt         time.Time       `json:"created_at" db:"created_at"`
}

// GeoObjectVersionResponse represents version info for API responses
type GeoObjectVersionResponse struct {
	ID                uuid.UUID       `json:"id"`
	ObjectID          uuid.UUID       `json:"object_id"`
	VersionNumber     int             `json:"version_number"`
	Snapshot          json.RawMessage `json:"snapshot,omitempty"`
	ChangeDescription string          `json:"change_description,omitempty"`
	CreatedBy         *uuid.UUID      `json:"created_by,omitempty"`
	CreatedAt         string          `json:"created_at"`
}

// VersionListResponse represents a list of versions
type VersionListResponse struct {
	Versions       []VersionInfoResponse `json:"versions"`
	Total          int                    `json:"total"`
	CurrentVersion int                   `json:"current_version"`
}

// VersionInfoResponse represents version metadata (without full snapshot)
type VersionInfoResponse struct {
	ID                uuid.UUID  `json:"id"`
	VersionNumber     int        `json:"version_number"`
	CreatedAt         string     `json:"created_at"`
	CreatedBy         *uuid.UUID `json:"created_by,omitempty"`
	ChangeDescription string     `json:"change_description,omitempty"`
	Changes           VersionChanges `json:"changes"`
}

// VersionChanges indicates what fields changed in this version
type VersionChanges struct {
	Geometry    bool `json:"geometry"`
	Name        bool `json:"name"`
	Description bool `json:"description"`
	Type        bool `json:"type"`
	Scope       bool `json:"scope"`
	Metadata    bool `json:"metadata"`
}

// VersionCompareResult represents the result of comparing two versions
type VersionCompareResult struct {
	Version1    *GeoObjectWithGeometry `json:"version1"`
	Version2    *GeoObjectWithGeometry `json:"version2"`
	Diff        VersionDiff            `json:"diff"`
}

// VersionDiff represents the differences between two versions
type VersionDiff struct {
	GeometryChanged bool   `json:"geometry_changed"`
	NameChanged     bool   `json:"name_changed"`
	DescriptionChanged bool `json:"description_changed"`
	TypeChanged     bool   `json:"type_changed"`
	ScopeChanged    bool   `json:"scope_changed"`
	MetadataChanged bool   `json:"metadata_changed"`
	GeometryDiff    GeometryDiffInfo `json:"geometry_diff,omitempty"`
}

// GeometryDiffInfo contains information about geometry changes
type GeometryDiffInfo struct {
	Type            string `json:"type"`
	OldCoordsCount  int    `json:"old_coords_count"`
	NewCoordsCount  int    `json:"new_coords_count"`
}
