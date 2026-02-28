package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrObjectNotFound = errors.New("object not found")
)

// GeoObjectRepository handles geo object database operations
type GeoObjectRepository struct {
	db *sqlx.DB
}

// NewGeoObjectRepository creates a new GeoObjectRepository instance
func NewGeoObjectRepository(db *sqlx.DB) *GeoObjectRepository {
	return &GeoObjectRepository{db: db}
}

// Create creates a new geo object in the database
func (r *GeoObjectRepository) Create(ctx context.Context, obj *model.GeoObject) error {
	query := `
		INSERT INTO geo_objects (id, owner_id, scope, type, name, description, metadata, geometry, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromGeoJSON($8), $9, $10)
	`

	// Extract geometry from Feature if needed (Leaflet Draw produces Feature objects)
	// First marshal to JSON, then extract geometry
	geometryBytes, err := json.Marshal(obj.Geometry)
	if err != nil {
		log.Printf("[ERROR] Failed to marshal geometry: %v", err)
		return err
	}

	geometryJSON, err := extractGeometryJSON(geometryBytes)
	if err != nil {
		log.Printf("[ERROR] Failed to extract geometry: %v", err)
		return err
	}

	// Ensure metadata is valid JSON (not empty string)
	metadata := obj.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage("{}")
	}

	log.Printf("[DEBUG] Creating geo object: id=%s, type=%s, name=%s, geometry=%s", 
		obj.ID, obj.Type, obj.Name, string(geometryJSON))

	_, err = r.db.ExecContext(ctx, query,
		obj.ID,
		obj.OwnerID,
		obj.Scope,
		obj.Type,
		obj.Name,
		obj.Description,
		metadata,
		string(geometryJSON),
		obj.CreatedAt,
		obj.UpdatedAt,
	)

	if err != nil {
		log.Printf("[ERROR] Failed to create geo object: %v", err)
		return err
	}

	log.Printf("[INFO] Successfully created geo object: %s", obj.ID)
	return nil
}

// extractGeometryJSON extracts the geometry from a Feature object if needed
func extractGeometryJSON(geometry []byte) (json.RawMessage, error) {
	// Try to parse as Feature
	var feature struct {
		Type     string          `json:"type"`
		Geometry json.RawMessage `json:"geometry"`
	}
	if err := json.Unmarshal(geometry, &feature); err == nil {
		if feature.Type == "Feature" && len(feature.Geometry) > 0 {
			log.Printf("[DEBUG] Extracted geometry from Feature")
			return feature.Geometry, nil
		}
	}
	// Return original if not a Feature
	return json.RawMessage(geometry), nil
}

// GetByID retrieves a geo object by ID
func (r *GeoObjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.GeoObjectWithGeometry, error) {
	query := `
		SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, 
		       ST_AsGeoJSON(geometry) as geometry, created_at, updated_at
		FROM geo_objects
		WHERE id = $1
	`

	var obj model.GeoObjectWithGeometry
	var geometryDB []byte
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&obj.ID,
		&obj.OwnerID,
		&obj.Scope,
		&obj.Type,
		&obj.Name,
		&obj.Description,
		&obj.Metadata,
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

// GetAll retrieves all accessible geo objects (global + owned private)
func (r *GeoObjectRepository) GetAll(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, search string) ([]model.GeoObjectWithGeometry, error) {
	var query string
	var args []interface{}

	// Build search filter
	searchFilter := ""
	addSearch := func() {
		if search != "" {
			idx := len(args) + 1
			searchFilter = fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", idx, idx)
			args = append(args, search)
		}
	}

	if isAdmin {
		if objType != "" {
			args = []interface{}{objType}
			addSearch()
			query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE type = $1` + searchFilter + ` ORDER BY created_at DESC LIMIT 50`
		} else {
			addSearch()
			if searchFilter != "" {
				// Remove leading " AND " for WHERE clause
				query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE` + searchFilter[4:] + ` ORDER BY created_at DESC LIMIT 50`
			} else {
				query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects ORDER BY created_at DESC`
			}
		}
	} else {
		if objType != "" {
			args = []interface{}{userID, objType}
			addSearch()
			query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE (scope = 'global' OR owner_id = $1) AND type = $2` + searchFilter + ` ORDER BY created_at DESC LIMIT 50`
		} else {
			args = []interface{}{userID}
			addSearch()
			query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE (scope = 'global' OR owner_id = $1)` + searchFilter + ` ORDER BY created_at DESC LIMIT 50`
		}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var geometryDB []byte
		err := rows.Scan(
			&obj.ID,
			&obj.OwnerID,
			&obj.Scope,
			&obj.Type,
			&obj.Name,
			&obj.Description,
			&obj.Metadata,
			&geometryDB,
			&obj.CreatedAt,
			&obj.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		obj.Geometry = json.RawMessage(geometryDB)
		objects = append(objects, obj)
	}

	return objects, nil
}

// typesForZoom returns allowed object types for a given zoom level.
// At low zoom, only large features are shown; at high zoom, everything is visible.
func typesForZoom(zoom int) []string {
	switch {
	case zoom <= 6:
		// National level: only boundaries and regions
		return []string{"region", "boundary", "administrative"}
	case zoom <= 9:
		// Country/Region level: large water and main roads
		return []string{"region", "boundary", "administrative", "river", "lake", "road"}
	case zoom <= 12:
		// District level: add forests and mountains
		return []string{"region", "boundary", "administrative", "river", "lake", "road", "forest", "mountain", "city"}
	case zoom <= 13:
		// City approach: everything except buildings
		return []string{"region", "boundary", "administrative", "river", "lake", "road", "forest", "mountain", "city", "custom", "other"}
	default:
		// zoom 14+: everything including buildings (only for visible area)
		return nil // nil means no filter
	}
}

// GetByBBox retrieves geo objects within a bounding box with 100% geometric accuracy
func (r *GeoObjectRepository) GetByBBox(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, minLat, minLng, maxLat, maxLng float64, zoom int, clip bool, filterByZoom bool, search string) ([]model.GeoObjectWithGeometry, error) {
	var query string
	var args []interface{}

	// BBox coordinates
	bboxSQL := "ST_MakeEnvelope($1, $2, $3, $4, 4326)"

	// RAW GEOMETRY: No simplification, no clipping, 100% accuracy
	geomSQL := "ST_AsGeoJSON(ST_MakeValid(geometry)) as geometry"

	// Build type filter: if objType is empty and filterByZoom is true, apply zoom logic.
	// However, if we want "All Objects" without zoom restrictions, we skip this.
	zoomFilter := ""
	if objType == "" && filterByZoom {
		allowed := typesForZoom(zoom)
		if allowed != nil {
			zoomFilter = " AND type IN ("
			for i, t := range allowed {
				if i > 0 {
					zoomFilter += ","
				}
				zoomFilter += fmt.Sprintf("'%s'", t)
			}
			zoomFilter += ")"
		}
	}

	// For RAW accuracy and full data, we still need a reasonable limit to prevent DB crash, 
	// but we increase it to 15,000 objects per request.
	const maxResults = 15000
	orderAndLimit := fmt.Sprintf(" LIMIT %d", maxResults)

	if isAdmin {
		if objType != "" {
			args = []interface{}{minLng, minLat, maxLng, maxLat, objType}
			searchFilter := ""
			if search != "" {
				searchFilter = fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1)
				args = append(args, search)
			}
			query = `
				SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata,
				       ` + geomSQL + `, created_at, updated_at
				FROM geo_objects
				WHERE type = $5 AND geometry && ` + bboxSQL + searchFilter + orderAndLimit + `
			`
		} else {
			args = []interface{}{minLng, minLat, maxLng, maxLat}
			searchFilter := ""
			if search != "" {
				searchFilter = fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1)
				args = append(args, search)
			}
			query = `
				SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata,
				       ` + geomSQL + `, created_at, updated_at
				FROM geo_objects
				WHERE geometry && ` + bboxSQL + zoomFilter + searchFilter + orderAndLimit + `
			`
		}
	} else {
		if objType != "" {
			args = []interface{}{minLng, minLat, maxLng, maxLat, userID, objType}
			searchFilter := ""
			if search != "" {
				searchFilter = fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1)
				args = append(args, search)
			}
			query = `
				SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata,
				       ` + geomSQL + `, created_at, updated_at
				FROM geo_objects
				WHERE (scope = 'global' OR owner_id = $5)
				  AND type = $6 AND geometry && ` + bboxSQL + searchFilter + orderAndLimit + `
			`
		} else {
			args = []interface{}{minLng, minLat, maxLng, maxLat, userID}
			searchFilter := ""
			if search != "" {
				searchFilter = fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1)
				args = append(args, search)
			}
			query = `
				SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata,
				       ` + geomSQL + `, created_at, updated_at
				FROM geo_objects
				WHERE (scope = 'global' OR owner_id = $5)
				  AND geometry && ` + bboxSQL + zoomFilter + searchFilter + orderAndLimit + `
			`
		}
	}

	log.Printf("[DEBUG] GetByBBox query: type=%s zoom=%d clip=%v filterByZoom=%v", objType, zoom, clip, filterByZoom)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		log.Printf("[ERROR] GetByBBox SQL error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var description sql.NullString
		var geometryDB sql.NullString
		err := rows.Scan(
			&obj.ID,
			&obj.OwnerID,
			&obj.Scope,
			&obj.Type,
			&obj.Name,
			&description,
			&obj.Metadata,
			&geometryDB,
			&obj.CreatedAt,
			&obj.UpdatedAt,
		)
		if err != nil {
			log.Printf("[ERROR] GetByBBox scan error: %v (type=%s)", err, obj.Type)
			return nil, err
		}
		if description.Valid {
			obj.Description = description.String
		}
		// Skip rows with NULL/empty geometry (can happen from ST_Intersection edge cases)
		if !geometryDB.Valid || geometryDB.String == "" || geometryDB.String == "null" {
			continue
		}
		obj.Geometry = json.RawMessage(geometryDB.String)
		objects = append(objects, obj)
	}

	log.Printf("[DEBUG] GetByBBox returned %d objects", len(objects))
	return objects, nil
}

// GetByType retrieves geo objects by type
func (r *GeoObjectRepository) GetByType(ctx context.Context, objType string) ([]model.GeoObjectWithGeometry, error) {
	query := `
		SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, 
		       ST_AsGeoJSON(geometry) as geometry, created_at, updated_at
		FROM geo_objects
		WHERE type = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, objType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var geometryDB []byte
		err := rows.Scan(
			&obj.ID,
			&obj.OwnerID,
			&obj.Scope,
			&obj.Type,
			&obj.Name,
			&obj.Description,
			&obj.Metadata,
			&geometryDB,
			&obj.CreatedAt,
			&obj.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		obj.Geometry = json.RawMessage(geometryDB)
		objects = append(objects, obj)
	}

	return objects, nil
}

// Update updates a geo object in the database
func (r *GeoObjectRepository) Update(ctx context.Context, obj *model.GeoObject) error {
	query := `
		UPDATE geo_objects
		SET scope = $2, type = $3, name = $4, description = $5, 
		    metadata = $6, geometry = ST_GeomFromGeoJSON($7), updated_at = $8
		WHERE id = $1
	`

	geometryJSON, err := json.Marshal(obj.Geometry)
	if err != nil {
		return err
	}

	result, err := r.db.ExecContext(ctx, query,
		obj.ID,
		obj.Scope,
		obj.Type,
		obj.Name,
		obj.Description,
		obj.Metadata,
		string(geometryJSON),
		obj.UpdatedAt,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrObjectNotFound
	}

	return nil
}

// Delete deletes a geo object from the database
func (r *GeoObjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		DELETE FROM geo_objects
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrObjectNotFound
	}

	return nil
}

// GetByOwner retrieves geo objects by owner
func (r *GeoObjectRepository) GetByOwner(ctx context.Context, ownerID uuid.UUID) ([]model.GeoObjectWithGeometry, error) {
	query := `
		SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, 
		       ST_AsGeoJSON(geometry) as geometry, created_at, updated_at
		FROM geo_objects
		WHERE owner_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var geometryDB []byte
		err := rows.Scan(
			&obj.ID,
			&obj.OwnerID,
			&obj.Scope,
			&obj.Type,
			&obj.Name,
			&obj.Description,
			&obj.Metadata,
			&geometryDB,
			&obj.CreatedAt,
			&obj.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		obj.Geometry = json.RawMessage(geometryDB)
		objects = append(objects, obj)
	}

	return objects, nil
}
