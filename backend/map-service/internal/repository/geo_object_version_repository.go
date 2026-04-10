package repository

import (
	"context"
	"database/sql"
	"errors"
	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// GeoObjectVersionRepository handles database operations for versions
type GeoObjectVersionRepository struct {
	db *sqlx.DB
}

// NewGeoObjectVersionRepository creates a new instance
func NewGeoObjectVersionRepository(db *sqlx.DB) *GeoObjectVersionRepository {
	return &GeoObjectVersionRepository{db: db}
}

// GetByGeoObjectID retrieves all versions for a specific object
func (r *GeoObjectVersionRepository) GetByGeoObjectID(ctx context.Context, geoObjectID uuid.UUID) ([]model.GeoObjectVersion, error) {
	query := `
		SELECT id, geo_object_id, version, name, description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, created_by
		FROM geo_object_versions
		WHERE geo_object_id = $1
		ORDER BY version DESC
	`

	versions := make([]model.GeoObjectVersion, 0)
	err := r.db.SelectContext(ctx, &versions, query, geoObjectID)
	return versions, err
}

// GetByID retrieves a single version entry
func (r *GeoObjectVersionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.GeoObjectVersion, error) {
	query := `
		SELECT id, geo_object_id, version, name, description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, created_by
		FROM geo_object_versions
		WHERE id = $1
	`

	var entry model.GeoObjectVersion
	err := r.db.GetContext(ctx, &entry, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("version not found")
		}
		return nil, err
	}
	return &entry, nil
}

// Create inserts a new version record
func (r *GeoObjectVersionRepository) Create(ctx context.Context, entry *model.GeoObjectVersion) error {
	query := `
		INSERT INTO geo_object_versions (id, geo_object_id, version, name, description, metadata, geometry, created_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromGeoJSON($7), $8, $9)
	`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.GeoObjectID, entry.Version, entry.Name,
		entry.Description, entry.Metadata, entry.Geometry, entry.CreatedAt, entry.CreatedBy,
	)
	return err
}

// DeleteByID removes a version entry
func (r *GeoObjectVersionRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM geo_object_versions WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// GetLatestVersion gets the highest version number for a geo object
func (r *GeoObjectVersionRepository) GetLatestVersion(ctx context.Context, geoObjectID uuid.UUID) (int, error) {
	query := `
		SELECT COALESCE(MAX(version), 0)
		FROM geo_object_versions
		WHERE geo_object_id = $1
	`

	var version int
	err := r.db.GetContext(ctx, &version, query, geoObjectID)
	return version, err
}

// GetByBaseIDAndVersion retrieves a specific version of a geo object
func (r *GeoObjectVersionRepository) GetByBaseIDAndVersion(ctx context.Context, geoObjectID uuid.UUID, version int) (*model.GeoObjectVersion, error) {
	query := `
		SELECT id, geo_object_id, version, name, description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, created_by
		FROM geo_object_versions
		WHERE geo_object_id = $1 AND version = $2
	`

	var entry model.GeoObjectVersion
	err := r.db.GetContext(ctx, &entry, query, geoObjectID, version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("version not found")
		}
		return nil, err
	}
	return &entry, nil
}
