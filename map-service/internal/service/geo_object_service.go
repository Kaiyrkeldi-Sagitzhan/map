package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"map-service/internal/dto"
	"map-service/internal/model"
	"map-service/internal/repository"
	"map-service/pkg/geometry"

	"github.com/google/uuid"
)

var (
	ErrInvalidScope   = errors.New("invalid scope")
	ErrInvalidType    = errors.New("invalid object type")
	ErrAccessDenied   = errors.New("access denied")
	ErrObjectNotFound = errors.New("object not found")
)

// GeoObjectService handles geo object business logic
type GeoObjectService struct {
	repo *repository.GeoObjectRepository
}

// NewGeoObjectService creates a new GeoObjectService instance
func NewGeoObjectService(repo *repository.GeoObjectRepository) *GeoObjectService {
	return &GeoObjectService{repo: repo}
}

// Create creates a new geo object
func (s *GeoObjectService) Create(ctx context.Context, userID uuid.UUID, req *dto.CreateGeoObjectRequest, isAdmin bool) (*dto.GeoObjectResponse, error) {
	log.Printf("[DEBUG] CreateGeoObject: userID=%s, isAdmin=%v, scope=%s, type=%s, name=%s",
		userID, isAdmin, req.Scope, req.Type, req.Name)

	// Validate scope
	if !model.IsValidScope(req.Scope) {
		return nil, ErrInvalidScope
	}

	// Validate type
	if !model.IsValidType(req.Type) {
		return nil, ErrInvalidType
	}

	// Validate geometry
	geomType, err := geometry.ParseGeometryType(req.Geometry)
	if err != nil {
		return nil, fmt.Errorf("invalid geometry format: %w", err)
	}
	if !geometry.ValidateGeometryType(geomType) {
		return nil, fmt.Errorf("invalid geometry type: %s (expected Point, LineString, Polygon, etc.)", geomType)
	}

	// Determine owner_id based on scope
	var ownerID *uuid.UUID
	if req.Scope == model.ScopePrivate {
		ownerID = &userID
	} else if req.Scope == model.ScopeGlobal {
		// Only admin can create global objects
		if !isAdmin {
			return nil, ErrAccessDenied
		}
		ownerID = nil
	}

	now := time.Now()
	obj := &model.GeoObject{
		ID:          uuid.New(),
		OwnerID:     ownerID,
		Scope:       req.Scope,
		Type:        req.Type,
		Name:        req.Name,
		Description: req.Description,
		Metadata:    req.Metadata,
		Geometry:    req.Geometry,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	err = s.repo.Create(ctx, obj)
	if err != nil {
		return nil, err
	}

	return &dto.GeoObjectResponse{
		ID:          obj.ID,
		OwnerID:     obj.OwnerID,
		Scope:       obj.Scope,
		Type:        obj.Type,
		Name:        obj.Name,
		Description: obj.Description,
		Metadata:    obj.Metadata,
		Geometry:    obj.Geometry.(json.RawMessage),
		CreatedAt:   obj.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   obj.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// GetByID retrieves a geo object by ID
func (s *GeoObjectService) GetByID(ctx context.Context, id uuid.UUID, userID uuid.UUID, isAdmin bool) (*dto.GeoObjectResponse, error) {
	obj, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			return nil, ErrObjectNotFound
		}
		return nil, err
	}

	// Check access
	if !s.canAccess(obj, userID, isAdmin) {
		return nil, ErrAccessDenied
	}

	resp := toResponse(obj)
	return &resp, nil
}

// GetAll retrieves all accessible geo objects
func (s *GeoObjectService) GetAll(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string) (*dto.GeoObjectListResponse, error) {
	objects, err := s.repo.GetAll(ctx, userID, isAdmin, objType)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.GeoObjectResponse, len(objects))
	for i, obj := range objects {
		resp := toResponse(&obj)
		log.Printf("[DEBUG] GetAll object %d: id=%s, type=%s, geometry=%s", i+1, obj.ID, obj.Type, string(obj.Geometry))
		responses[i] = resp
	}

	return &dto.GeoObjectListResponse{
		Objects: responses,
		Total:   len(responses),
	}, nil
}

// Update updates a geo object
func (s *GeoObjectService) Update(ctx context.Context, id uuid.UUID, userID uuid.UUID, isAdmin bool, req *dto.UpdateGeoObjectRequest) (*dto.GeoObjectResponse, error) {
	// Get existing object
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			return nil, ErrObjectNotFound
		}
		return nil, err
	}

	// Check ownership/admin
	if !s.canModify(existing, userID, isAdmin) {
		return nil, ErrAccessDenied
	}

	// Validate scope if provided
	if req.Scope != "" && !model.IsValidScope(req.Scope) {
		return nil, ErrInvalidScope
	}

	// Validate type if provided
	if req.Type != "" && !model.IsValidType(req.Type) {
		return nil, ErrInvalidType
	}

	// Validate geometry if provided
	if len(req.Geometry) > 0 {
		geomType, err := geometry.ParseGeometryType(req.Geometry)
		if err != nil {
			return nil, errors.New("invalid geometry format")
		}
		if !geometry.ValidateGeometryType(geomType) {
			return nil, errors.New("invalid geometry type")
		}
	}

	// Update fields
	now := time.Now()
	obj := &model.GeoObject{
		ID:          id,
		OwnerID:     existing.OwnerID,
		Scope:       existing.Scope,
		Type:        existing.Type,
		Name:        existing.Name,
		Description: existing.Description,
		Metadata:    existing.Metadata,
		Geometry:    existing.Geometry,
		UpdatedAt:   now,
	}

	// Apply updates
	if req.Scope != "" {
		obj.Scope = req.Scope
	}
	if req.Type != "" {
		obj.Type = req.Type
	}
	if req.Name != "" {
		obj.Name = req.Name
	}
	if req.Description != "" {
		obj.Description = req.Description
	}
	if req.Metadata != nil {
		obj.Metadata = req.Metadata
	}
	if len(req.Geometry) > 0 {
		obj.Geometry = req.Geometry
	}

	// Determine owner_id based on scope change
	if req.Scope != "" && req.Scope != existing.Scope {
		if obj.Scope == model.ScopePrivate {
			obj.OwnerID = &userID
		} else if obj.Scope == model.ScopeGlobal {
			obj.OwnerID = nil
		}
	}

	err = s.repo.Update(ctx, obj)
	if err != nil {
		return nil, err
	}

	// Get updated object
	updated, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	resp := toResponse(updated)
	return &resp, nil
}

// Delete deletes a geo object
func (s *GeoObjectService) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID, isAdmin bool) error {
	// Get existing object
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			return ErrObjectNotFound
		}
		return err
	}

	// Check ownership/admin
	if !s.canModify(existing, userID, isAdmin) {
		return ErrAccessDenied
	}

	return s.repo.Delete(ctx, id)
}

// canAccess checks if user can access the object
func (s *GeoObjectService) canAccess(obj *model.GeoObjectWithGeometry, userID uuid.UUID, isAdmin bool) bool {
	if obj.Scope == model.ScopeGlobal {
		return true
	}
	if isAdmin {
		return true
	}
	if obj.OwnerID != nil && *obj.OwnerID == userID {
		return true
	}
	return false
}

// canModify checks if user can modify the object
func (s *GeoObjectService) canModify(obj *model.GeoObjectWithGeometry, userID uuid.UUID, isAdmin bool) bool {
	if isAdmin {
		return true
	}
	if obj.OwnerID != nil && *obj.OwnerID == userID {
		return true
	}
	return false
}

// toResponse converts model to DTO
func toResponse(obj *model.GeoObjectWithGeometry) dto.GeoObjectResponse {
	resp := dto.GeoObjectResponse{
		ID:          obj.ID,
		OwnerID:     obj.OwnerID,
		Scope:       obj.Scope,
		Type:        obj.Type,
		Name:        obj.Name,
		Description: obj.Description,
		Metadata:    obj.Metadata,
		Geometry:    obj.Geometry,
		CreatedAt:   obj.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   obj.UpdatedAt.Format(time.RFC3339),
	}
	return resp
}
