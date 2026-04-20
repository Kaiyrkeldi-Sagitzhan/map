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

	responses := make([]dto.GeoObjectHistoryResponse, 0, len(history)+1)
	for _, h := range history {
		responses = append(responses, dto.GeoObjectHistoryResponse{
			ID:             h.ID,
			ObjectID:       h.ObjectID,
			UserID:         h.UserID,
			Action:         h.Action,
			Description:    h.Description,
			BeforeSnapshot: h.BeforeSnapshot,
			AfterSnapshot:  h.AfterSnapshot,
			CreatedAt:      h.CreatedAt,
		})
	}

	// Prepend a virtual "Initial state" entry when there is no real "create"
	// record (e.g. objects loaded via gpkg import). Without this, the first
	// edit makes the original state vanish from the timeline.
	hasCreate := false
	for _, r := range responses {
		if r.Action == "create" {
			hasCreate = true
			break
		}
	}
	if !hasCreate {
		obj, err := s.objectRepo.GetByID(ctx, objectID)
		if err == nil && obj != nil {
			// Prefer the beforeSnapshot of the oldest entry (the pre-edit state);
			// fall back to current object state when no edits have happened yet.
			var snap json.RawMessage
			if n := len(responses); n > 0 && responses[n-1].BeforeSnapshot != nil && len(*responses[n-1].BeforeSnapshot) > 0 {
				snap = *responses[n-1].BeforeSnapshot
			} else {
				snapshot, _ := json.Marshal(obj)
				snap = json.RawMessage(snapshot)
			}
			responses = append(responses, dto.GeoObjectHistoryResponse{
				ID:            uuid.Nil,
				ObjectID:      objectID,
				Action:        "create",
				Description:   "Исходное состояние (импортировано)",
				AfterSnapshot: &snap,
				CreatedAt:     obj.CreatedAt,
			})
		}
	}

	return responses, nil
}

// Rollback restores an object to a previous state
func (s *GeoObjectHistoryService) Rollback(ctx context.Context, historyID uuid.UUID, userID uuid.UUID) error {
	// historyID == uuid.Nil is the virtual "Initial state" entry produced by
	// GetByObjectID for imported objects with no real history. There's no row
	// to look up, so reject the rollback with a clear message.
	if historyID == uuid.Nil {
		return errors.New("cannot rollback to the imported initial state")
	}

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
	_, err = s.objectRepo.GetByID(ctx, entry.ObjectID)
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
