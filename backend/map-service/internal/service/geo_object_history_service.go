package service

import (
	"context"
	"encoding/json"
	"errors"
	"map-service/internal/dto"
	"map-service/internal/model"
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

// GetObjectByID retrieves an object by ID
func (s *GeoObjectHistoryService) GetObjectByID(ctx context.Context, id string) (*model.GeoObjectWithGeometry, error) {
	return s.objectRepo.GetByID(ctx, id)
}

// GetByObjectID retrieves history for an object
func (s *GeoObjectHistoryService) GetByObjectID(ctx context.Context, objectID uuid.UUID, limit int) ([]dto.GeoObjectHistoryResponse, error) {
	history, err := s.historyRepo.GetByObjectID(ctx, objectID, limit)
	if err != nil {
		return nil, err
	}

	// If no history exists, try to create a virtual "Initial State" entry
	if len(history) == 0 {
		obj, err := s.objectRepo.GetByID(ctx, objectID.String())
		if err == nil && obj != nil {
			// Create a snapshot of current state
			snapshot, _ := json.Marshal(obj)
			snapRaw := json.RawMessage(snapshot)
			return []dto.GeoObjectHistoryResponse{
				{
					ID:            uuid.Nil,
					ObjectID:      objectID,
					Action:        "create",
					Description:   "Исходное состояние (импортировано)",
					AfterSnapshot: &snapRaw,
					CreatedAt:     obj.CreatedAt,
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

	snapshot := entry.AfterSnapshot
	if entry.Action == "delete" {
		snapshot = entry.BeforeSnapshot
	}

	if snapshot == nil || len(*snapshot) == 0 || string(*snapshot) == "null" {
		return errors.New("cannot rollback: no snapshot data available")
	}

	// Check if object still exists
	_, err = s.objectRepo.GetByID(ctx, entry.ObjectID.String())
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			// Restore deleted object
			return s.objectRepo.RestoreFromSnapshot(ctx, entry.ObjectID, *snapshot)
		}
		return err
	}

	// Update existing object
	return s.objectRepo.UpdateFromSnapshot(ctx, entry.ObjectID, *snapshot)
}
