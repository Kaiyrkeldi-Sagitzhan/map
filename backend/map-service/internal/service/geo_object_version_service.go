package service

import (
	"context"
	"encoding/json"
	"map-service/internal/dto"
	"map-service/internal/model"
	"map-service/internal/repository"
	"time"

	"github.com/google/uuid"
)

// GeoObjectVersionService handles business logic for versions
type GeoObjectVersionService struct {
	versionRepo *repository.GeoObjectVersionRepository
	objectRepo  *repository.GeoObjectRepository
}

// NewGeoObjectVersionService creates a new instance
func NewGeoObjectVersionService(vRepo *repository.GeoObjectVersionRepository, oRepo *repository.GeoObjectRepository) *GeoObjectVersionService {
	return &GeoObjectVersionService{
		versionRepo: vRepo,
		objectRepo:  oRepo,
	}
}

// GetByGeoObjectID retrieves all versions for an object
func (s *GeoObjectVersionService) GetByGeoObjectID(ctx context.Context, geoObjectID uuid.UUID) ([]dto.GeoObjectVersionResponse, error) {
	versions, err := s.versionRepo.GetByGeoObjectID(ctx, geoObjectID)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.GeoObjectVersionResponse, len(versions))
	for i, v := range versions {
		// Parse geometry from string to interface{}
		var geom interface{}
		if err := json.Unmarshal([]byte(v.Geometry), &geom); err != nil {
			return nil, err
		}

		responses[i] = dto.GeoObjectVersionResponse{
			ID:          v.ID,
			GeoObjectID: v.GeoObjectID.String(),
			Version:     v.Version,
			Name:        v.Name,
			Description: v.Description,
			Metadata:    v.Metadata,
			Geometry:    geom,
			CreatedAt:   v.CreatedAt,
			CreatedBy:   v.CreatedBy,
		}
	}
	return responses, nil
}

// Create creates a new version for a geo object
func (s *GeoObjectVersionService) Create(ctx context.Context, req dto.CreateGeoObjectVersionRequest, userID uuid.UUID) (*dto.GeoObjectVersionResponse, error) {
	// Parse geoObjectID from string to UUID
	geoObjectUUID, err := uuid.Parse(req.GeoObjectID)
	if err != nil {
		return nil, err
	}

	// Check if object exists
	_, err = s.objectRepo.GetByID(ctx, req.GeoObjectID)
	if err != nil {
		return nil, err
	}

	// Get the next version number
	latestVersion, err := s.versionRepo.GetLatestVersion(ctx, geoObjectUUID)
	if err != nil {
		return nil, err
	}

	// Marshal geometry to string
	geomBytes, err := json.Marshal(req.Geometry)
	if err != nil {
		return nil, err
	}

	version := &model.GeoObjectVersion{
		ID:          uuid.New(),
		GeoObjectID: geoObjectUUID,
		Version:     latestVersion + 1,
		Name:        req.Name,
		Description: req.Description,
		Metadata:    req.Metadata,
		Geometry:    string(geomBytes),
		CreatedAt:   time.Now(),
		CreatedBy:   &userID,
	}

	err = s.versionRepo.Create(ctx, version)
	if err != nil {
		return nil, err
	}

	return &dto.GeoObjectVersionResponse{
		ID:          version.ID,
		GeoObjectID: version.GeoObjectID.String(),
		Version:     version.Version,
		Name:        version.Name,
		Description: version.Description,
		Metadata:    version.Metadata,
		Geometry:    version.Geometry,
		CreatedAt:   version.CreatedAt,
		CreatedBy:   version.CreatedBy,
	}, nil
}

// CreateFromCurrentObject creates a version from the current state of the object
func (s *GeoObjectVersionService) CreateFromCurrentObject(ctx context.Context, geoObjectID string, name, description string, userID uuid.UUID) (*dto.GeoObjectVersionResponse, error) {
	// Get current object
	obj, err := s.objectRepo.GetByID(ctx, geoObjectID)
	if err != nil {
		return nil, err
	}

	// Parse geometry (it's already GeoJSON as json.RawMessage)
	var geom interface{}
	if err := json.Unmarshal(obj.Geometry, &geom); err != nil {
		return nil, err
	}

	req := dto.CreateGeoObjectVersionRequest{
		GeoObjectID: geoObjectID,
		Name:        name,
		Description: description,
		Metadata:    obj.Metadata,
		Geometry:    geom,
	}

	return s.Create(ctx, req, userID)
}

// GetByGeoObjectIDAndVersion retrieves a specific version
func (s *GeoObjectVersionService) GetByGeoObjectIDAndVersion(ctx context.Context, geoObjectID uuid.UUID, version int) (*dto.GeoObjectVersionResponse, error) {
	v, err := s.versionRepo.GetByBaseIDAndVersion(ctx, geoObjectID, version)
	if err != nil {
		return nil, err
	}

	// Parse geometry
	var geom interface{}
	if err := json.Unmarshal([]byte(v.Geometry), &geom); err != nil {
		return nil, err
	}

	return &dto.GeoObjectVersionResponse{
		ID:          v.ID,
		GeoObjectID: v.GeoObjectID.String(),
		Version:     v.Version,
		Name:        v.Name,
		Description: v.Description,
		Metadata:    v.Metadata,
		Geometry:    geom,
		CreatedAt:   v.CreatedAt,
		CreatedBy:   v.CreatedBy,
	}, nil
}
