package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

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
func (r *GeoObjectRepository) GetAll(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, search string, metaFilters map[string]string) ([]model.GeoObjectWithGeometry, error) {
	var query string
	var args []interface{}
	whereClauses := []string{"1=1"}

	if !isAdmin {
		whereClauses = append(whereClauses, fmt.Sprintf("(scope = 'global' OR owner_id = $%d)", len(args)+1))
		args = append(args, userID)
	}

	if objType != "" {
		if objType == "lake" || objType == "water" {
			whereClauses = append(whereClauses, "(type IN ('lake', 'water', 'reservoir') OR metadata->>'fclass' IN ('lake', 'water', 'reservoir'))")
		} else if objType == "mountain" || objType == "peak" {
			whereClauses = append(whereClauses, "(type IN ('mountain', 'peak') OR metadata->>'fclass' IN ('mountain', 'peak'))")
		} else {
			whereClauses = append(whereClauses, fmt.Sprintf("(type = $%d OR metadata->>'fclass' = $%d)", len(args)+1, len(args)+1))
			args = append(args, objType)
		}
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1))
		args = append(args, search)
	}

	for k, v := range metaFilters {
		whereClauses = append(whereClauses, fmt.Sprintf("metadata->>'%s' = $%d", k, len(args)+1))
		args = append(args, v)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects` + whereSQL + ` ORDER BY created_at DESC LIMIT 50`

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
func typesForZoom(zoom int) []string {
	switch {
	case zoom <= 6:
		return []string{"region", "boundary", "administrative"}
	case zoom <= 9:
		return []string{"region", "boundary", "administrative", "river", "lake", "road"}
	case zoom <= 12:
		return []string{"region", "boundary", "administrative", "river", "lake", "road", "forest", "mountain", "city"}
	case zoom <= 13:
		return []string{"region", "boundary", "administrative", "river", "lake", "road", "forest", "mountain", "city", "custom", "other"}
	default:
		return nil
	}
}

// GetByBBox retrieves geo objects within a bounding box
func (r *GeoObjectRepository) GetByBBox(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, minLat, minLng, maxLat, maxLng float64, zoom int, clip bool, filterByZoom bool, search string, metaFilters map[string]string) ([]model.GeoObjectWithGeometry, error) {
	var query string
	var args []interface{}
	whereClauses := []string{"geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)"}
	args = []interface{}{minLng, minLat, maxLng, maxLat}

	if !isAdmin {
		whereClauses = append(whereClauses, fmt.Sprintf("(scope = 'global' OR owner_id = $%d)", len(args)+1))
		args = append(args, userID)
	}

	if objType != "" {
		if objType == "lake" || objType == "water" {
			whereClauses = append(whereClauses, "(type IN ('lake', 'water', 'reservoir') OR metadata->>'fclass' IN ('lake', 'water', 'reservoir'))")
		} else if objType == "mountain" || objType == "peak" {
			whereClauses = append(whereClauses, "(type IN ('mountain', 'peak') OR metadata->>'fclass' IN ('mountain', 'peak'))")
		} else {
			whereClauses = append(whereClauses, fmt.Sprintf("(type = $%d OR metadata->>'fclass' = $%d)", len(args)+1, len(args)+1))
			args = append(args, objType)
		}
	} else if filterByZoom {
		allowed := typesForZoom(zoom)
		if allowed != nil {
			typesSQL := "type IN ("
			for i, t := range allowed {
				if i > 0 { typesSQL += "," }
				typesSQL += fmt.Sprintf("'%s'", t)
			}
			typesSQL += ")"
			whereClauses = append(whereClauses, typesSQL)
		}
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(name ILIKE '%%' || $%d || '%%' OR description ILIKE '%%' || $%d || '%%')", len(args)+1, len(args)+1))
		args = append(args, search)
	}

	for k, v := range metaFilters {
		whereClauses = append(whereClauses, fmt.Sprintf("metadata->>'%s' = $%d", k, len(args)+1))
		args = append(args, v)
	}

	geomSQL := "ST_AsGeoJSON(ST_MakeValid(geometry)) as geometry"
	query = `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ` + geomSQL + `, created_at, updated_at FROM geo_objects WHERE ` + strings.Join(whereClauses, " AND ")

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var description sql.NullString
		var geometryDB sql.NullString
		err := rows.Scan(&obj.ID, &obj.OwnerID, &obj.Scope, &obj.Type, &obj.Name, &description, &obj.Metadata, &geometryDB, &obj.CreatedAt, &obj.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if description.Valid { obj.Description = description.String }
		if !geometryDB.Valid || geometryDB.String == "" || geometryDB.String == "null" { continue }
		obj.Geometry = json.RawMessage(geometryDB.String)
		objects = append(objects, obj)
	}
	return objects, nil
}

// GetByType retrieves geo objects by type
func (r *GeoObjectRepository) GetByType(ctx context.Context, objType string) ([]model.GeoObjectWithGeometry, error) {
	query := `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE type = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, objType)
	if err != nil { return nil, err }
	defer rows.Close()
	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var geometryDB []byte
		err := rows.Scan(&obj.ID, &obj.OwnerID, &obj.Scope, &obj.Type, &obj.Name, &obj.Description, &obj.Metadata, &geometryDB, &obj.CreatedAt, &obj.UpdatedAt)
		if err != nil { return nil, err }
		obj.Geometry = json.RawMessage(geometryDB)
		objects = append(objects, obj)
	}
	return objects, nil
}

// Update updates a geo object in the database
func (r *GeoObjectRepository) Update(ctx context.Context, obj *model.GeoObject) error {
	query := `UPDATE geo_objects SET scope = $2, type = $3, name = $4, description = $5, metadata = $6, geometry = ST_GeomFromGeoJSON($7), updated_at = $8 WHERE id = $1`
	geometryBytes, _ := json.Marshal(obj.Geometry)
	geometryJSON, _ := extractGeometryJSON(geometryBytes)
	metadata := obj.Metadata
	if len(metadata) == 0 { metadata = json.RawMessage("{}") }
	result, err := r.db.ExecContext(ctx, query, obj.ID, obj.Scope, obj.Type, obj.Name, obj.Description, metadata, string(geometryJSON), obj.UpdatedAt)
	if err != nil { return err }
	rows, _ := result.RowsAffected()
	if rows == 0 { return ErrObjectNotFound }
	return nil
}

// Delete deletes a geo object from the database
func (r *GeoObjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM geo_objects WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil { return err }
	rows, _ := result.RowsAffected()
	if rows == 0 { return ErrObjectNotFound }
	return nil
}

// GetByOwner retrieves geo objects by owner
func (r *GeoObjectRepository) GetByOwner(ctx context.Context, ownerID uuid.UUID) ([]model.GeoObjectWithGeometry, error) {
	query := `SELECT id, owner_id, scope, type, name, COALESCE(description, '') as description, metadata, ST_AsGeoJSON(geometry) as geometry, created_at, updated_at FROM geo_objects WHERE owner_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, ownerID)
	if err != nil { return nil, err }
	defer rows.Close()
	var objects []model.GeoObjectWithGeometry
	for rows.Next() {
		var obj model.GeoObjectWithGeometry
		var geometryDB []byte
		err := rows.Scan(&obj.ID, &obj.OwnerID, &obj.Scope, &obj.Type, &obj.Name, &obj.Description, &obj.Metadata, &geometryDB, &obj.CreatedAt, &obj.UpdatedAt)
		if err != nil { return nil, err }
		obj.Geometry = json.RawMessage(geometryDB)
		objects = append(objects, obj)
	}
	return objects, nil
}

// GetTileMVT generates a vector tile (MVT)
func (r *GeoObjectRepository) GetTileMVT(ctx context.Context, z, x, y int) ([]byte, error) {
	query := `
		WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS geom),
		mvt_geom AS (
			SELECT id, name, type, metadata, ST_AsMVTGeom(ST_Transform(geometry, 3857), bounds.geom, 4096, 256, true) AS geom
			FROM geo_objects, bounds
			WHERE ST_Intersects(ST_Transform(geometry, 3857), bounds.geom)
		)
		SELECT ST_AsMVT(mvt_geom.*, 'objects') FROM mvt_geom;
	`
	var tile []byte
	err := r.db.GetContext(ctx, &tile, query, z, x, y)
	return tile, err
}

// UpdateFromSnapshot updates a geo object from a history snapshot
func (r *GeoObjectRepository) UpdateFromSnapshot(ctx context.Context, id uuid.UUID, snapshot json.RawMessage) error {
	var data map[string]interface{}
	json.Unmarshal(snapshot, &data)
	scope, _ := data["scope"].(string)
	objType, _ := data["type"].(string)
	name, _ := data["name"].(string)
	description, _ := data["description"].(string)
	var metadata json.RawMessage
	if m, ok := data["metadata"]; ok {
		mBytes, _ := json.Marshal(m)
		metadata = json.RawMessage(mBytes)
	}
	var geometry interface{}
	if g, ok := data["geometry"]; ok { geometry = g }
	query := `UPDATE geo_objects SET scope = $2, type = $3, name = $4, description = $5, metadata = $6, geometry = ST_GeomFromGeoJSON($7), updated_at = NOW() WHERE id = $1`
	geometryBytes, _ := json.Marshal(geometry)
	geometryJSON, _ := extractGeometryJSON(geometryBytes)
	_, err := r.db.ExecContext(ctx, query, id, scope, objType, name, description, metadata, string(geometryJSON))
	return err
}

// RestoreFromSnapshot restores a deleted geo object
func (r *GeoObjectRepository) RestoreFromSnapshot(ctx context.Context, id uuid.UUID, snapshot json.RawMessage) error {
	var data map[string]interface{}
	json.Unmarshal(snapshot, &data)
	ownerIDVal, _ := data["owner_id"]
	scope, _ := data["scope"].(string)
	objType, _ := data["type"].(string)
	name, _ := data["name"].(string)
	description, _ := data["description"].(string)
	var metadata json.RawMessage
	if m, ok := data["metadata"]; ok {
		mBytes, _ := json.Marshal(m)
		metadata = json.RawMessage(mBytes)
	}
	var geometry interface{}
	if g, ok := data["geometry"]; ok { geometry = g }
	var ownerID *uuid.UUID
	if s, ok := ownerIDVal.(string); ok && s != "" {
		if u, err := uuid.Parse(s); err == nil { ownerID = &u }
	}
	query := `INSERT INTO geo_objects (id, owner_id, scope, type, name, description, metadata, geometry, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromGeoJSON($8), NOW(), NOW())`
	geometryBytes, _ := json.Marshal(geometry)
	geometryJSON, _ := extractGeometryJSON(geometryBytes)
	_, err := r.db.ExecContext(ctx, query, id, ownerID, scope, objType, name, description, metadata, string(geometryJSON))
	return err
}
