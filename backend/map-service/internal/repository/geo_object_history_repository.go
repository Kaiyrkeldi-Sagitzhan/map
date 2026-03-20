package repository

import (
	"context"
	"database/sql"
	"errors"
	"map-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// GeoObjectHistoryRepository handles database operations for history
type GeoObjectHistoryRepository struct {
	db *sqlx.DB
}

// NewGeoObjectHistoryRepository creates a new instance
func NewGeoObjectHistoryRepository(db *sqlx.DB) *GeoObjectHistoryRepository {
	return &GeoObjectHistoryRepository{db: db}
}

// GetByObjectID retrieves history for a specific object
func (r *GeoObjectHistoryRepository) GetByObjectID(ctx context.Context, objectID uuid.UUID, limit int) ([]model.GeoObjectHistory, error) {
	query := `
		SELECT id, object_id, user_id, action, description, before_snapshot, after_snapshot, created_at
		FROM geo_object_history
		WHERE object_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	
	history := make([]model.GeoObjectHistory, 0)
	err := r.db.SelectContext(ctx, &history, query, objectID, limit)
	return history, err
}

// GetByID retrieves a single history entry
func (r *GeoObjectHistoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.GeoObjectHistory, error) {
	query := `
		SELECT id, object_id, user_id, action, description, before_snapshot, after_snapshot, created_at
		FROM geo_object_history
		WHERE id = $1
	`
	
	var entry model.GeoObjectHistory
	err := r.db.GetContext(ctx, &entry, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("history entry not found")
		}
		return nil, err
	}
	return &entry, nil
}

// Create inserts a new history record
func (r *GeoObjectHistoryRepository) Create(ctx context.Context, entry *model.GeoObjectHistory) error {
	query := `
		INSERT INTO geo_object_history (id, object_id, user_id, action, description, before_snapshot, after_snapshot, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.ExecContext(ctx, query,
		entry.ID, entry.ObjectID, entry.UserID, entry.Action,
		entry.Description, entry.BeforeSnapshot, entry.AfterSnapshot, entry.CreatedAt,
	)
	return err
}

// DeleteByID removes a history entry
func (r *GeoObjectHistoryRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM geo_object_history WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
