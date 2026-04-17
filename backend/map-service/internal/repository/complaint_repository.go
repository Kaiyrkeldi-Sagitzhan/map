package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrComplaintNotFound = errors.New("complaint not found")
)

// ComplaintRepository handles complaint database operations
type ComplaintRepository struct {
	db *sqlx.DB
}

// NewComplaintRepository creates a new ComplaintRepository
func NewComplaintRepository(db *sqlx.DB) *ComplaintRepository {
	return &ComplaintRepository{db: db}
}

// Create creates a new complaint
func (r *ComplaintRepository) Create(ctx context.Context, complaint *model.Complaint) error {
	query := `
		INSERT INTO complaints (id, user_id, object_id, object_type, description, status, admin_notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.ExecContext(ctx, query,
		complaint.ID,
		complaint.UserID,
		complaint.ObjectID,
		complaint.ObjectType,
		complaint.Description,
		complaint.Status,
		complaint.AdminNotes,
		complaint.CreatedAt,
		complaint.UpdatedAt,
	)
	return err
}

// GetByID retrieves a complaint by ID with user info
func (r *ComplaintRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ComplaintWithUser, error) {
	query := `
		SELECT c.id, c.user_id, c.object_id, c.object_type, c.description, c.status, c.admin_notes, c.created_at, c.updated_at,
			   u.email as user_email,
			   COALESCE(g.name, '') as object_name
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		LEFT JOIN geo_objects g ON g.id = c.object_id
		WHERE c.id = $1
	`
	var complaint model.ComplaintWithUser
	err := r.db.GetContext(ctx, &complaint, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrComplaintNotFound
		}
		return nil, err
	}
	return &complaint, nil
}

// List returns paginated complaints with optional status filter
func (r *ComplaintRepository) List(ctx context.Context, status string, page, limit int) ([]model.ComplaintWithUser, error) {
	offset := (page - 1) * limit

	var complaints []model.ComplaintWithUser
	var err error

	if status != "" {
		query := `
			SELECT c.id, c.user_id, c.object_id, c.object_type, c.description, c.status, c.admin_notes, c.created_at, c.updated_at,
				   u.email as user_email,
				   COALESCE(g.name, '') as object_name
			FROM complaints c
			JOIN users u ON u.id = c.user_id
			LEFT JOIN geo_objects g ON g.id = c.object_id
			WHERE c.status = $1
			ORDER BY c.created_at DESC
			LIMIT $2 OFFSET $3
		`
		err = r.db.SelectContext(ctx, &complaints, query, status, limit, offset)
	} else {
		query := `
			SELECT c.id, c.user_id, c.object_id, c.object_type, c.description, c.status, c.admin_notes, c.created_at, c.updated_at,
				   u.email as user_email,
				   COALESCE(g.name, '') as object_name
			FROM complaints c
			JOIN users u ON u.id = c.user_id
			LEFT JOIN geo_objects g ON g.id = c.object_id
			ORDER BY c.created_at DESC
			LIMIT $1 OFFSET $2
		`
		err = r.db.SelectContext(ctx, &complaints, query, limit, offset)
	}

	if err != nil {
		return nil, err
	}

	return complaints, nil
}

// Count returns total complaint count with optional status filter
func (r *ComplaintRepository) Count(ctx context.Context, status string) (int, error) {
	var count int
	var err error

	if status != "" {
		err = r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM complaints WHERE status = $1`, status)
	} else {
		err = r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM complaints`)
	}

	if err != nil {
		return 0, err
	}
	return count, nil
}

// Update updates a complaint's status and admin notes
func (r *ComplaintRepository) Update(ctx context.Context, id uuid.UUID, status string, adminNotes string) error {
	query := `UPDATE complaints SET status = $2, admin_notes = $3 WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id, status, adminNotes)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrComplaintNotFound
	}
	return nil
}

// TypeStats represents object count per type
type TypeStats struct {
	Type         string  `db:"type" json:"type"`
	Count        int     `db:"count" json:"count"`
	CentroidJSON *string `db:"centroid_json" json:"-"`
}

// GetStatsByType returns object counts grouped by type with centroids
func (r *ComplaintRepository) GetStatsByType(ctx context.Context) ([]TypeStats, error) {
	// Use materialized view for instant response (refreshed after each import)
	query := `
		SELECT type, count, centroid_json
		FROM geo_object_type_stats
		ORDER BY count DESC
	`
	var stats []TypeStats
	err := r.db.SelectContext(ctx, &stats, query)
	if err != nil {
		// Fallback: compute live (slow but correct if view doesn't exist yet)
		fallbackQuery := `
			SELECT type, COUNT(*) as count,
				   ST_AsGeoJSON(ST_Centroid(ST_Extent(geometry)))::text as centroid_json
			FROM geo_objects
			WHERE scope = 'global'
			GROUP BY type
			ORDER BY count DESC
		`
		err2 := r.db.SelectContext(ctx, &stats, fallbackQuery)
		if err2 != nil {
			return nil, fmt.Errorf("stats query failed: %w", err)
		}
	}
	return stats, nil
}
