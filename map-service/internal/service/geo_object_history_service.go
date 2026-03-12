package service

import (
	"context"
	"encoding/json"
	"errors"
	"map-service/internal/dto"
	"map-service/internal/repository"

	"github.com/google/uuid"
)

// GeoObjectHistoryService handles business logic for history
type GeoObjectHistoryService struct {
	historyRepo *repository.GeoObjectHistoryRepository
	objectRepo  *repository.GeoObjectRepository
}

// NewGeoObjectHistoryService creates a new instance
func NewGeoObjectHistoryService(hRepo *repository.GeoObjectHistoryRepository, oRepo *repository.GeoObjectRepository) *GeoObjectHistoryService {
	return &GeoObjectHistoryService{
		historyRepo: hRepo,
		objectRepo:  oRepo,
	}
}

// GetByObjectID retrieves history for an object
func (s *GeoObjectHistoryService) GetByObjectID(ctx context.Context, objectID uuid.UUID, limit int) ([]dto.GeoObjectHistoryResponse, error) {
	history, err := s.historyRepo.GetByObjectID(ctx, objectID, limit)
	if err != nil {
		return nil, err
	}

	// If no history exists, try to create a virtual "Initial State" entry
	if len(history) == 0 {
		obj, err := s.objectRepo.GetByID(ctx, objectID)
		if err == nil && obj != nil {
			// Create a snapshot of current state
			snapshot, _ := json.Marshal(obj)
			return []dto.GeoObjectHistoryResponse{
				{
					ID:          uuid.Nil,
					ObjectID:    objectID,
					Action:      "create",
					Description: "Исходное состояние (импортировано)",
					AfterSnapshot: snapshot,
					CreatedAt:   obj.CreatedAt,
				},
			}, nil
		}
	}

	responses := make([]dto.GeoObjectHistoryResponse, len(history))
	for i, h := range history {
		responses[i] = dto.GeoObjectHistoryResponse{
			ID:             h.ID,
			ObjectID:       h.ObjectID,
			UserID:         h.UserID,
			Action:         h.Action,
			Description:    h.Description,
			BeforeSnapshot: h.BeforeSnapshot,
			AfterSnapshot:  h.AfterSnapshot,
			CreatedAt:      h.CreatedAt,
		}
	}
	return responses, nil
}

// Rollback restores an object to a previous state
func (s *GeoObjectHistoryService) Rollback(ctx context.Context, historyID uuid.UUID, userID uuid.UUID) error {
	entry, err := s.historyRepo.GetByID(ctx, historyID)
	if err != nil {
		return err
	}

	// For rollback, we use the before_snapshot if it exists (for update/delete)
	// or the after_snapshot if we want to restore specifically that state.
	// Typically, a user selects a point in history they want to RETURN TO.
	// So we use the after_snapshot of that entry.
	
	snapshot := entry.AfterSnapshot
	if entry.Action == "delete" {
		// If rolling back a delete, we use the state before it was deleted
		snapshot = entry.BeforeSnapshot
	}

	if len(snapshot) == 0 || string(snapshot) == "null" {
		return errors.New("cannot rollback: no snapshot data available")
	}

	// Check if object still exists
	_, err = s.objectRepo.GetByID(ctx, entry.ObjectID)
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			// Restore deleted object
			return s.objectRepo.RestoreFromSnapshot(ctx, entry.ObjectID, snapshot)
		}
		return err
	}

	// Update existing object
	return s.objectRepo.UpdateFromSnapshot(ctx, entry.ObjectID, snapshot)
}
