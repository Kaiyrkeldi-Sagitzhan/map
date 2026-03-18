package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"map-service/internal/dto"
	"map-service/internal/model"
	"map-service/internal/repository"

	"github.com/google/uuid"
)

// ComplaintService handles complaint business logic
type ComplaintService struct {
	repo  *repository.ComplaintRepository
	cache *repository.RedisCache
}

// NewComplaintService creates a new ComplaintService
func NewComplaintService(repo *repository.ComplaintRepository, cache *repository.RedisCache) *ComplaintService {
	return &ComplaintService{repo: repo, cache: cache}
}

// Create creates a new complaint
func (s *ComplaintService) Create(ctx context.Context, userID uuid.UUID, req *dto.CreateComplaintRequest) (*dto.ComplaintResponse, error) {
	now := time.Now()
	complaint := &model.Complaint{
		ID:          uuid.New(),
		UserID:      userID,
		ObjectID:    req.ObjectID,
		ObjectType:  req.ObjectType,
		Description: req.Description,
		Status:      model.ComplaintStatusPending,
		AdminNotes:  "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	err := s.repo.Create(ctx, complaint)
	if err != nil {
		return nil, err
	}

	// Fetch back with user info
	result, err := s.repo.GetByID(ctx, complaint.ID)
	if err != nil {
		// Return basic response if join fails
		return &dto.ComplaintResponse{
			ID:          complaint.ID,
			UserID:      complaint.UserID,
			ObjectID:    complaint.ObjectID,
			ObjectType:  complaint.ObjectType,
			Description: complaint.Description,
			Status:      complaint.Status,
			CreatedAt:   complaint.CreatedAt.Format(time.RFC3339),
			UpdatedAt:   complaint.UpdatedAt.Format(time.RFC3339),
		}, nil
	}

	return complaintToResponse(result), nil
}

// GetByID returns a complaint by ID
func (s *ComplaintService) GetByID(ctx context.Context, id uuid.UUID) (*dto.ComplaintResponse, error) {
	result, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return complaintToResponse(result), nil
}

// List returns paginated complaints
func (s *ComplaintService) List(ctx context.Context, status string, page, limit int) (*dto.ComplaintListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	complaints, err := s.repo.List(ctx, status, page, limit)
	if err != nil {
		return nil, err
	}

	total, err := s.repo.Count(ctx, status)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.ComplaintResponse, len(complaints))
	for i, c := range complaints {
		responses[i] = *complaintToResponse(&c)
	}

	return &dto.ComplaintListResponse{
		Complaints: responses,
		Total:      total,
		Page:       page,
		Limit:      limit,
	}, nil
}

// Update updates a complaint's status and admin notes
func (s *ComplaintService) Update(ctx context.Context, id uuid.UUID, req *dto.UpdateComplaintRequest) (*dto.ComplaintResponse, error) {
	if req.Status != "" && !model.IsValidComplaintStatus(req.Status) {
		return nil, errors.New("invalid complaint status")
	}

	// Get current complaint
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	status := existing.Status
	if req.Status != "" {
		status = req.Status
	}
	notes := existing.AdminNotes
	if req.AdminNotes != "" {
		notes = req.AdminNotes
	}

	err = s.repo.Update(ctx, id, status, notes)
	if err != nil {
		return nil, err
	}

	result, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return complaintToResponse(result), nil
}

// GetStats returns object counts by type
func (s *ComplaintService) GetStats(ctx context.Context) (*dto.StatsResponse, error) {
	// Try cache first
	if s.cache != nil {
		cachedData, err := s.cache.GetStats(ctx)
		if err == nil && cachedData != nil {
			var resp dto.StatsResponse
			if err := json.Unmarshal(cachedData, &resp); err == nil {
				return &resp, nil
			}
		}
	}

	typeStats, err := s.repo.GetStatsByType(ctx)
	if err != nil {
		return nil, err
	}

	total := 0
	stats := make([]dto.TypeStat, len(typeStats))
	for i, ts := range typeStats {
		total += ts.Count
		stat := dto.TypeStat{
			Type:  ts.Type,
			Count: ts.Count,
		}

		// Parse centroid from GeoJSON
		if ts.CentroidJSON != nil && *ts.CentroidJSON != "" {
			var geojson struct {
				Coordinates []float64 `json:"coordinates"`
			}
			if err := json.Unmarshal([]byte(*ts.CentroidJSON), &geojson); err == nil && len(geojson.Coordinates) >= 2 {
				centroid := []float64{geojson.Coordinates[1], geojson.Coordinates[0]} // lat, lng
				stat.Centroid = &centroid
			}
		}

		stats[i] = stat
	}

	resp := &dto.StatsResponse{
		Stats: stats,
		Total: total,
	}

	// Save to cache
	if s.cache != nil {
		if data, err := json.Marshal(resp); err == nil {
			_ = s.cache.SetStats(ctx, data)
		}
	}

	return resp, nil
}

func complaintToResponse(c *model.ComplaintWithUser) *dto.ComplaintResponse {
	return &dto.ComplaintResponse{
		ID:          c.ID,
		UserID:      c.UserID,
		UserEmail:   c.UserEmail,
		ObjectID:    c.ObjectID,
		ObjectType:  c.ObjectType,
		ObjectName:  c.ObjectName,
		Description: c.Description,
		Status:      c.Status,
		AdminNotes:  c.AdminNotes,
		CreatedAt:   c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   c.UpdatedAt.Format(time.RFC3339),
	}
}
