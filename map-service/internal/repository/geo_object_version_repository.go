package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"

	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrVersionNotFound = errors.New("version not found")
)

// GeoObjectVersionRepository handles geo object version database operations
type GeoObjectVersionRepository struct {
	db *sqlx.DB
}

// NewGeoObjectVersionRepository creates a new GeoObjectVersionRepository instance
func NewGeoObjectVersionRepository(db *sqlx.DB) *GeoObjectVersionRepository {
	return &GeoObjectVersionRepository{db: db}
}

// CreateVersion creates a new version snapshot in the database
func (r *GeoObjectVersionRepository) CreateVersion(ctx context.Context, version *model.GeoObjectVersion) error {
	query := `
		INSERT INTO geo_object_versions (id, object_id, version_number, snapshot, change_description, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (object_id, version_number) DO UPDATE
		SET snapshot = EXCLUDED.snapshot,
		    change_description = EXCLUDED.change_description,
		    created_by = EXCLUDED.created_by
	`

	_, err := r.db.ExecContext(ctx, query,
		version.ID,
		version.ObjectID,
		version.VersionNumber,
		version.Snapshot,
		version.ChangeDescription,
		version.CreatedBy,
		version.CreatedAt,
	)

	if err != nil {
		return err
	}

	return nil
}

// GetVersionsByObjectID retrieves all versions for a geo object
func (r *GeoObjectVersionRepository) GetVersionsByObjectID(ctx context.Context, objectID uuid.UUID) ([]model.GeoObjectVersion, error) {
	query := `
		SELECT id, object_id, version_number, snapshot, COALESCE(change_description, '') as change_description, created_by, created_at
		FROM geo_object_versions
		WHERE object_id = $1
		ORDER BY version_number DESC
	`

	rows, err := r.db.QueryContext(ctx, query, objectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []model.GeoObjectVersion
	for rows.Next() {
		var version model.GeoObjectVersion
		err := rows.Scan(
			&version.ID,
			&version.ObjectID,
			&version.VersionNumber,
			&version.Snapshot,
			&version.ChangeDescription,
			&version.CreatedBy,
			&version.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}

	return versions, nil
}

// GetVersionByID retrieves a specific version by its ID
func (r *GeoObjectVersionRepository) GetVersionByID(ctx context.Context, versionID uuid.UUID) (*model.GeoObjectVersion, error) {
	query := `
		SELECT id, object_id, version_number, snapshot, COALESCE(change_description, '') as change_description, created_by, created_at
		FROM geo_object_versions
		WHERE id = $1
	`

	var version model.GeoObjectVersion
	err := r.db.QueryRowContext(ctx, query, versionID).Scan(
		&version.ID,
		&version.ObjectID,
		&version.VersionNumber,
		&version.Snapshot,
		&version.ChangeDescription,
		&version.CreatedBy,
		&version.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}

	return &version, nil
}

// GetVersionByNumber retrieves a specific version by object ID and version number
func (r *GeoObjectVersionRepository) GetVersionByNumber(ctx context.Context, objectID uuid.UUID, versionNumber int) (*model.GeoObjectVersion, error) {
	query := `
		SELECT id, object_id, version_number, snapshot, COALESCE(change_description, '') as change_description, created_by, created_at
		FROM geo_object_versions
		WHERE object_id = $1 AND version_number = $2
	`

	var version model.GeoObjectVersion
	err := r.db.QueryRowContext(ctx, query, objectID, versionNumber).Scan(
		&version.ID,
		&version.ObjectID,
		&version.VersionNumber,
		&version.Snapshot,
		&version.ChangeDescription,
		&version.CreatedBy,
		&version.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}

	return &version, nil
}

// GetAllHistoricalVersions retrieves all historical (old) versions for map display
func (r *GeoObjectVersionRepository) GetAllHistoricalVersions(ctx context.Context) ([]model.GeoObjectWithGeometry, error) {
	// Query all versions from geo_object_versions table
	query := `
		SELECT id, object_id, version_number, snapshot, change_description, created_by, created_at
		FROM geo_object_versions
		ORDER BY object_id, version_number DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var version model.GeoObjectVersion
		err := rows.Scan(
			&version.ID,
			&version.ObjectID,
			&version.VersionNumber,
			&version.Snapshot,
			&version.ChangeDescription,
			&version.CreatedBy,
			&version.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Parse snapshot JSON to get the geo object data
		var snapshotData map[string]interface{}
		if err := json.Unmarshal(version.Snapshot, &snapshotData); err != nil {
			log.Printf("[WARN] Failed to parse snapshot for version %s: %v", version.ID, err)
			continue
		}

		// Extract geometry from snapshot
		var geometry json.RawMessage
		if geom, ok := snapshotData["geometry"]; ok {
			geomBytes, err := json.Marshal(geom)
			if err == nil {
				geometry = geomBytes
			}
		}

		// Build the geo object from snapshot
		obj := model.GeoObjectWithGeometry{
			ID:            version.ObjectID,
			IsVersion:     true,
			VersionNumber: version.VersionNumber,
			CreatedAt:     version.CreatedAt,
			UpdatedAt:     version.CreatedAt, // Use created_at as updated_at for versions
			Geometry:      geometry,
		}

		// Extract other fields from snapshot
		if id, ok := snapshotData["id"].(string); ok {
			if parsedID, err := uuid.Parse(id); err == nil {
				obj.ID = parsedID
			}
		}
		if ownerID, ok := snapshotData["owner_id"].(string); ok {
			if parsed, err := uuid.Parse(ownerID); err == nil {
				obj.OwnerID = &parsed
			}
		}
		if scope, ok := snapshotData["scope"].(string); ok {
			obj.Scope = scope
		}
		if objType, ok := snapshotData["type"].(string); ok {
			obj.Type = objType
		}
		if name, ok := snapshotData["name"].(string); ok {
			obj.Name = name
		}
		if desc, ok := snapshotData["description"].(string); ok {
			obj.Description = desc
		}
		if metadata, ok := snapshotData["metadata"]; ok {
			metadataBytes, err := json.Marshal(metadata)
			if err == nil {
				obj.Metadata = metadataBytes
			}
		}

		objects = append(objects, obj)
	}

	return objects, nil
}

// GetCurrentVersionNumber returns the current (latest) version number for an object
func (r *GeoObjectVersionRepository) GetCurrentVersionNumber(ctx context.Context, objectID uuid.UUID) (int, error) {
	query := `
		SELECT COALESCE(MAX(version_number), 0)
		FROM geo_object_versions
		WHERE object_id = $1
	`

	var versionNumber int
	err := r.db.QueryRowContext(ctx, query, objectID).Scan(&versionNumber)
	if err != nil {
		return 0, err
	}

	return versionNumber, nil
}

// GetLiveObject retrieves the current (non-version) object
func (r *GeoObjectVersionRepository) GetLiveObject(ctx context.Context, id uuid.UUID) (*model.GeoObjectWithGeometry, error) {
	query := `
		SELECT id, owner_id, parent_id, scope, type, name, COALESCE(description, '') as description, metadata, 
		       is_version, version_number,
		       ST_AsGeoJSON(geometry) as geometry, created_at, updated_at
		FROM geo_objects
		WHERE id = $1 AND (is_version = false OR is_version IS NULL)
	`

	var obj model.GeoObjectWithGeometry
	var geometryDB []byte
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&obj.ID,
		&obj.OwnerID,
		&obj.ParentID,
		&obj.Scope,
		&obj.Type,
		&obj.Name,
		&obj.Description,
		&obj.Metadata,
		&obj.IsVersion,
		&obj.VersionNumber,
		&geometryDB,
		&obj.CreatedAt,
		&obj.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrObjectNotFound
		}
		return nil, err
	}

	obj.Geometry = json.RawMessage(geometryDB)
	return &obj, nil
}

// GetTwoVersionsForCompare retrieves two versions for comparison
func (r *GeoObjectVersionRepository) GetTwoVersionsForCompare(ctx context.Context, objectID uuid.UUID, v1, v2 int) (*model.GeoObjectWithGeometry, *model.GeoObjectWithGeometry, error) {
	// Get first version
	version1, err := r.GetVersionByNumber(ctx, objectID, v1)
	if err != nil {
		return nil, nil, err
	}

	// Get second version
	version2, err := r.GetVersionByNumber(ctx, objectID, v2)
	if err != nil {
		return nil, nil, err
	}

	// Parse snapshots
	var obj1 model.GeoObjectWithGeometry
	var obj2 model.GeoObjectWithGeometry

	if err := json.Unmarshal(version1.Snapshot, &obj1); err != nil {
		return nil, nil, err
	}

	if err := json.Unmarshal(version2.Snapshot, &obj2); err != nil {
		return nil, nil, err
	}

	return &obj1, &obj2, nil
}

// CalculateChanges compares two versions and returns what changed
func CalculateChanges(v1, v2 *model.GeoObjectWithGeometry) model.VersionChanges {
	changes := model.VersionChanges{}

	// Compare name
	if v1.Name != v2.Name {
		changes.Name = true
	}

	// Compare description
	if v1.Description != v2.Description {
		changes.Description = true
	}

	// Compare type
	if v1.Type != v2.Type {
		changes.Type = true
	}

	// Compare scope
	if v1.Scope != v2.Scope {
		changes.Scope = true
	}

	// Compare metadata
	if string(v1.Metadata) != string(v2.Metadata) {
		changes.Metadata = true
	}

	// Compare geometry
	if string(v1.Geometry) != string(v2.Geometry) {
		changes.Geometry = true
	}

	return changes
}

// GetNextVersionNumber returns the next available version number
func (r *GeoObjectVersionRepository) GetNextVersionNumber(ctx context.Context, objectID uuid.UUID) (int, error) {
	query := `
		SELECT COALESCE(MAX(version_number), 0) + 1
		FROM geo_object_versions
		WHERE object_id = $1
	`

	var nextVersion int
	err := r.db.QueryRowContext(ctx, query, objectID).Scan(&nextVersion)
	if err != nil {
		return 0, err
	}

	return nextVersion, nil
}
