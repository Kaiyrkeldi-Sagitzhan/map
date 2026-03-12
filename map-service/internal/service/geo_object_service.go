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
	repo        *repository.GeoObjectRepository
	historyRepo *repository.GeoObjectHistoryRepository
	cache       *repository.RedisCache
}

// NewGeoObjectService creates a new GeoObjectService instance
func NewGeoObjectService(repo *repository.GeoObjectRepository, historyRepo *repository.GeoObjectHistoryRepository, cache *repository.RedisCache) *GeoObjectService {
	return &GeoObjectService{repo: repo, historyRepo: historyRepo, cache: cache}
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

	// Record "create" history
	if s.historyRepo != nil {
		created, _ := s.repo.GetByID(ctx, obj.ID)
		if created != nil {
			afterSnap := buildSnapshot(created)
			historyEntry := &model.GeoObjectHistory{
				ID:            uuid.New(),
				ObjectID:      obj.ID,
				UserID:        userID,
				Action:        "create",
				Description:   fmt.Sprintf("Создан объект \"%s\"", obj.Name),
				AfterSnapshot: afterSnap,
				CreatedAt:     now,
			}
			if err := s.historyRepo.Create(ctx, historyEntry); err != nil {
				log.Printf("[WARN] Failed to record create history for object %s: %v", obj.ID, err)
			}
		}
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.InvalidateLists(ctx)
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
func (s *GeoObjectService) GetAll(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, search string, metaFilters map[string]string) (*dto.GeoObjectListResponse, error) {
	// Skip cache when text search or metadata filters are active
	if s.cache != nil && search == "" && len(metaFilters) == 0 {
		cachedObjects, err := s.cache.GetList(ctx, userID, isAdmin, objType)
		if err == nil && cachedObjects != nil {
			responses := make([]dto.GeoObjectResponse, len(cachedObjects))
			for i, obj := range cachedObjects {
				responses[i] = toResponse(&obj)
			}
			return &dto.GeoObjectListResponse{
				Objects: responses,
				Total:   len(responses),
			}, nil
		}
	}

	objects, err := s.repo.GetAll(ctx, userID, isAdmin, objType, search, metaFilters)
	if err != nil {
		return nil, err
	}

	// Save to cache only when no text search and no meta filters
	if s.cache != nil && search == "" && len(metaFilters) == 0 {
		_ = s.cache.SetList(ctx, userID, isAdmin, objType, objects)
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

// GetInBBox retrieves geo objects within a bounding box
func (s *GeoObjectService) GetInBBox(ctx context.Context, userID uuid.UUID, isAdmin bool, objType string, minLat, minLng, maxLat, maxLng float64, zoom int, clip bool, filterByZoom bool, search string, metaFilters map[string]string) (*dto.GeoObjectListResponse, error) {
	// Skip cache when text search or meta filters are active
	if s.cache != nil && search == "" && len(metaFilters) == 0 {
		cachedObjects, err := s.cache.GetBBox(ctx, zoom, minLat, minLng, maxLat, maxLng, objType, filterByZoom)
		if err == nil && cachedObjects != nil {
			responses := make([]dto.GeoObjectResponse, len(cachedObjects))
			for i, obj := range cachedObjects {
				responses[i] = toResponse(&obj)
			}
			return &dto.GeoObjectListResponse{
				Objects: responses,
				Total:   len(responses),
			}, nil
		}
	}

	objects, err := s.repo.GetByBBox(ctx, userID, isAdmin, objType, minLat, minLng, maxLat, maxLng, zoom, clip, filterByZoom, search, metaFilters)
	if err != nil {
		return nil, err
	}

	// Save to bbox cache only when no text search and no meta filters
	if s.cache != nil && search == "" && len(metaFilters) == 0 {
		_ = s.cache.SetBBox(ctx, zoom, minLat, minLng, maxLat, maxLng, objType, filterByZoom, objects)
	}

	responses := make([]dto.GeoObjectResponse, len(objects))
	for i, obj := range objects {
		responses[i] = toResponse(&obj)
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
	isNew := false
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			// If not found, we'll create it (Upsert logic for imported data)
			isNew = true
		} else {
			return nil, err
		}
	}

	// Check ownership/admin (only for existing objects)
	if !isNew && !s.canModify(existing, userID, isAdmin) {
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
	var obj *model.GeoObject

	if isNew {
		// Prepare new object from request
		var ownerID *uuid.UUID
		scope := req.Scope
		if scope == "" {
			scope = model.ScopeGlobal
		}
		
		if scope == model.ScopePrivate {
			ownerID = &userID
		}

		obj = &model.GeoObject{
			ID:          id,
			OwnerID:     ownerID,
			Scope:       scope,
			Type:        req.Type,
			Name:        req.Name,
			Description: req.Description,
			Metadata:    req.Metadata,
			Geometry:    req.Geometry,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		
		// Ensure basic fields aren't empty for new object
		if obj.Type == "" { obj.Type = "custom" }
		if obj.Name == "" { obj.Name = "Imported Object" }
		
		err = s.repo.Create(ctx, obj)
	} else {
		// Update existing object
		obj = &model.GeoObject{
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
	}

	if err != nil {
		return nil, err
	}

	// Get updated/created object
	updated, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Record history for updates on existing objects
	if !isNew && s.historyRepo != nil {
		beforeSnap := buildSnapshot(existing)
		afterSnap := buildSnapshot(updated)
		historyEntry := &model.GeoObjectHistory{
			ID:             uuid.New(),
			ObjectID:       id,
			UserID:         userID,
			Action:         "update",
			Description:    fmt.Sprintf("Изменён объект \"%s\"", updated.Name),
			BeforeSnapshot: beforeSnap,
			AfterSnapshot:  afterSnap,
			CreatedAt:      now,
		}
		if err := s.historyRepo.Create(ctx, historyEntry); err != nil {
			log.Printf("[WARN] Failed to record history for object %s: %v", id, err)
		}
	}

	// Invalidate cache
	if s.cache != nil {
		_ = s.cache.InvalidateLists(ctx)
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

	err = s.repo.Delete(ctx, id)
	if err == nil && s.cache != nil {
		_ = s.cache.InvalidateLists(ctx)
	}
	return err
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

// buildSnapshot creates a JSON snapshot of a geo object for history storage
func buildSnapshot(obj *model.GeoObjectWithGeometry) json.RawMessage {
	snap := map[string]interface{}{
		"owner_id":    obj.OwnerID,
		"scope":       obj.Scope,
		"type":        obj.Type,
		"name":        obj.Name,
		"description": obj.Description,
		"metadata":    obj.Metadata,
		"geometry":    obj.Geometry,
	}
	data, _ := json.Marshal(snap)
	return data
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

// GetTile coordinates retrieval of vector tiles via cache and repository
func (s *GeoObjectService) GetTile(ctx context.Context, z, x, y int) ([]byte, error) {
	if s.cache != nil {
		tile, err := s.cache.GetTile(ctx, z, x, y)
		if err == nil && tile != nil {
			log.Printf("[DEBUG] Tile cache HIT: %d/%d/%d", z, x, y)
			return tile, nil
		}
	}

	tile, err := s.repo.GetTileMVT(ctx, z, x, y)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && tile != nil {
		_ = s.cache.SetTile(ctx, z, x, y, tile)
	}

	log.Printf("[DEBUG] Tile cache MISS: %d/%d/%d (generated %d bytes)", z, x, y, len(tile))
	return tile, nil
}
