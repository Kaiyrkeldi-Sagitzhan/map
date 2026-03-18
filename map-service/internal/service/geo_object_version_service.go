package service

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"map-service/internal/dto"
	"map-service/internal/model"
	"map-service/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrVersionNotFound = errors.New("version not found")
	ErrNoVersions      = errors.New("no versions found")
)

// GeoObjectVersionService handles geo object version business logic
type GeoObjectVersionService struct {
	versionRepo  *repository.GeoObjectVersionRepository
	objectRepo  repository.GeoObjectRepositoryInterface
}

// NewGeoObjectVersionService creates a new GeoObjectVersionService instance
func NewGeoObjectVersionService(versionRepo *repository.GeoObjectVersionRepository, objectRepo repository.GeoObjectRepositoryInterface) *GeoObjectVersionService {
	return &GeoObjectVersionService{
		versionRepo: versionRepo,
		objectRepo:  objectRepo,
	}
}

// CreateManualVersion creates a manual version snapshot of the current object state
func (s *GeoObjectVersionService) CreateManualVersion(ctx context.Context, objectID uuid.UUID, userID uuid.UUID, description string) (*model.GeoObjectVersionResponse, error) {
	// Get the current live object
	obj, err := s.versionRepo.GetLiveObject(ctx, objectID)
	if err != nil {
		if errors.Is(err, repository.ErrObjectNotFound) {
			return nil, ErrObjectNotFound
		}
		return nil, err
	}

	// Get next version number
	nextVersion, err := s.versionRepo.GetNextVersionNumber(ctx, objectID)
	if err != nil {
		return nil, err
	}

	// Create snapshot
	snapshot := json.RawMessage{}
	geomJSON, err := json.Marshal(obj.Geometry)
	if err == nil {
		snapshot = geomJSON
	}

	snapshotData := map[string]interface{}{
		"id":          obj.ID,
		"owner_id":    obj.OwnerID,
		"scope":       obj.Scope,
		"type":        obj.Type,
		"name":        obj.Name,
		"description": obj.Description,
		"metadata":   obj.Metadata,
		"geometry":    snapshot,
		"created_at": obj.CreatedAt,
		"updated_at": obj.UpdatedAt,
	}

	snapshotJSON, err := json.Marshal(snapshotData)
	if err != nil {
		return nil, err
	}

	version := &model.GeoObjectVersion{
		ID:                uuid.New(),
		ObjectID:          objectID,
		VersionNumber:     nextVersion,
		Snapshot:          snapshotJSON,
		ChangeDescription: description,
		CreatedBy:         &userID,
		CreatedAt:         time.Now(),
	}

	err = s.versionRepo.CreateVersion(ctx, version)
	if err != nil {
		return nil, err
	}

	log.Printf("[INFO] Created manual version %d for object %s", nextVersion, objectID)

	return &model.GeoObjectVersionResponse{
		ID:                version.ID,
		ObjectID:          version.ObjectID,
		VersionNumber:     version.VersionNumber,
		Snapshot:          version.Snapshot,
		ChangeDescription: version.ChangeDescription,
		CreatedBy:         version.CreatedBy,
		CreatedAt:         version.CreatedAt.Format(time.RFC3339),
	}, nil
}

// GetVersions retrieves all versions for a geo object
func (s *GeoObjectVersionService) GetVersions(ctx context.Context, objectID uuid.UUID, userID uuid.UUID, isAdmin bool) (*model.VersionListResponse, error) {
	// First check if object exists and user has access
	obj, err := s.objectRepo.GetByID(ctx, objectID)
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

	// Get all versions
	versions, err := s.versionRepo.GetVersionsByObjectID(ctx, objectID)
	if err != nil {
		return nil, err
	}

	// Get current version number from live object
	currentVersion := obj.VersionNumber
	if currentVersion == 0 {
		// If no versions exist yet, get max from versions
		if len(versions) > 0 {
			currentVersion = versions[0].VersionNumber
		}
	}

	// Build response with change info
	versionInfos := make([]model.VersionInfoResponse, 0, len(versions))
	
	for i, v := range versions {
		var changes model.VersionChanges
		if i < len(versions)-1 {
			// Compare with next version (which is older)
			prevSnapshot := versions[i+1].Snapshot
			var prevObj model.GeoObjectWithGeometry
			if err := json.Unmarshal(prevSnapshot, &prevObj); err == nil {
				var currObj model.GeoObjectWithGeometry
				if err := json.Unmarshal(v.Snapshot, &currObj); err == nil {
					changes = repository.CalculateChanges(&prevObj, &currObj)
				}
			}
		}

		versionInfos = append(versionInfos, model.VersionInfoResponse{
			ID:                v.ID,
			VersionNumber:     v.VersionNumber,
			CreatedAt:         v.CreatedAt.Format(time.RFC3339),
			CreatedBy:         v.CreatedBy,
			ChangeDescription: v.ChangeDescription,
			Changes:           changes,
		})
	}

	// If no versions exist, return info about current state
	if len(versions) == 0 {
		return &model.VersionListResponse{
			Versions:       []model.VersionInfoResponse{},
			Total:          0,
			CurrentVersion: currentVersion,
		}, nil
	}

	return &model.VersionListResponse{
		Versions:       versionInfos,
		Total:          len(versions),
		CurrentVersion: currentVersion,
	}, nil
}

// GetAllHistoricalVersions retrieves all historical versions for map display
func (s *GeoObjectVersionService) GetAllHistoricalVersions(ctx context.Context, userID uuid.UUID, isAdmin bool) ([]*dto.GeoObjectResponse, error) {
	objects, err := s.versionRepo.GetAllHistoricalVersions(ctx)
	if err != nil {
		return nil, err
	}

	// Filter objects based on access rights
	var result []*dto.GeoObjectResponse
	for _, obj := range objects {
		// Get the parent (current) object to check access
		// obj.ID from GetAllHistoricalVersions is the parent object ID from snapshot
		parentObj, err := s.versionRepo.GetLiveObject(ctx, obj.ID)
		if err != nil {
			// If live object not found, skip this version
			log.Printf("[WARN] GetAllHistoricalVersions: live object not found for %s: %v", obj.ID, err)
			continue
		}

		// Check access rights based on parent object
		if parentObj.Scope == "private" && !isAdmin {
			if parentObj.OwnerID == nil || *parentObj.OwnerID != userID {
				continue
			}
		}

		resp := &dto.GeoObjectResponse{
			ID:          obj.ID,
			OwnerID:     parentObj.OwnerID,
			Scope:       parentObj.Scope,
			Type:        obj.Type,
			Name:        obj.Name,
			Description: obj.Description,
			Metadata:    obj.Metadata,
			Geometry:    obj.Geometry,
			CreatedAt:   obj.CreatedAt.Format(time.RFC3339),
			UpdatedAt:   obj.UpdatedAt.Format(time.RFC3339),
		}
		result = append(result, resp)
	}

	return result, nil
}

// GetVersion retrieves a specific version
func (s *GeoObjectVersionService) GetVersion(ctx context.Context, objectID uuid.UUID, versionID uuid.UUID, userID uuid.UUID, isAdmin bool) (*model.GeoObjectVersionResponse, error) {
	// Check if object exists and user has access
	obj, err := s.objectRepo.GetByID(ctx, objectID)
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

	// Get specific version
	version, err := s.versionRepo.GetVersionByID(ctx, versionID)
	if err != nil {
		if errors.Is(err, repository.ErrVersionNotFound) {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}

	return &model.GeoObjectVersionResponse{
		ID:                version.ID,
		ObjectID:          version.ObjectID,
		VersionNumber:     version.VersionNumber,
		Snapshot:          version.Snapshot,
		ChangeDescription: version.ChangeDescription,
		CreatedBy:         version.CreatedBy,
		CreatedAt:         version.CreatedAt.Format(time.RFC3339),
	}, nil
}

// GetVersionSnapshot retrieves a specific version's snapshot as a GeoObject
func (s *GeoObjectVersionService) GetVersionSnapshot(ctx context.Context, objectID uuid.UUID, versionNumber int, userID uuid.UUID, isAdmin bool) (*dto.GeoObjectResponse, error) {
	// Check if object exists and user has access
	obj, err := s.objectRepo.GetByID(ctx, objectID)
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

	// Get specific version
	version, err := s.versionRepo.GetVersionByNumber(ctx, objectID, versionNumber)
	if err != nil {
		if errors.Is(err, repository.ErrVersionNotFound) {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}

	// Parse snapshot into GeoObjectWithGeometry
	var snapshotObj model.GeoObjectWithGeometry
	if err := json.Unmarshal(version.Snapshot, &snapshotObj); err != nil {
		return nil, err
	}

	return &dto.GeoObjectResponse{
		ID:          snapshotObj.ID,
		OwnerID:     snapshotObj.OwnerID,
		Scope:       snapshotObj.Scope,
		Type:        snapshotObj.Type,
		Name:        snapshotObj.Name,
		Description: snapshotObj.Description,
		Metadata:    snapshotObj.Metadata,
		Geometry:    snapshotObj.Geometry,
		CreatedAt:   snapshotObj.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   snapshotObj.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// CompareVersions compares two versions and returns the differences
func (s *GeoObjectVersionService) CompareVersions(ctx context.Context, objectID uuid.UUID, v1, v2 int, userID uuid.UUID, isAdmin bool) (*model.VersionCompareResult, error) {
	// Check if object exists and user has access
	obj, err := s.objectRepo.GetByID(ctx, objectID)
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

	// Get two versions for comparison
	version1, version2, err := s.versionRepo.GetTwoVersionsForCompare(ctx, objectID, v1, v2)
	if err != nil {
		return nil, err
	}

	// Calculate changes
	changes := repository.CalculateChanges(version1, version2)

	// Build geometry diff info
	var geomDiff model.GeometryDiffInfo
	if changes.Geometry {
		var v1Geom, v2Geom map[string]interface{}
		if err := json.Unmarshal(version1.Geometry, &v1Geom); err == nil {
			if err := json.Unmarshal(version2.Geometry, &v2Geom); err == nil {
				geomDiff = model.GeometryDiffInfo{
					Type:            "",
					OldCoordsCount:  countCoords(v1Geom),
					NewCoordsCount:  countCoords(v2Geom),
				}
				if t, ok := v1Geom["type"].(string); ok {
					geomDiff.Type = t
				}
			}
		}
	}

	result := &model.VersionCompareResult{
		Version1: version1,
		Version2: version2,
		Diff: model.VersionDiff{
			GeometryChanged:      changes.Geometry,
			NameChanged:          changes.Name,
			DescriptionChanged:   changes.Description,
			TypeChanged:          changes.Type,
			ScopeChanged:         changes.Scope,
			MetadataChanged:      changes.Metadata,
			GeometryDiff:         geomDiff,
		},
	}

	return result, nil
}

// countCoords counts coordinates in a GeoJSON geometry
func countCoords(geom map[string]interface{}) int {
	switch geom["type"] {
	case "Point":
		if coords, ok := geom["coordinates"].([]interface{}); ok {
			return len(coords)
		}
	case "LineString":
		if coords, ok := geom["coordinates"].([]interface{}); ok {
			return len(coords)
		}
	case "Polygon":
		if rings, ok := geom["coordinates"].([]interface{}); ok {
			count := 0
			for _, ring := range rings {
				if coords, ok := ring.([]interface{}); ok {
					count += len(coords)
				}
			}
			return count
		}
	case "MultiPoint", "MultiLineString", "MultiPolygon":
		if coords, ok := geom["coordinates"].([]interface{}); ok {
			return len(coords)
		}
	}
	return 0
}

// canAccess checks if user can access the object
func (s *GeoObjectVersionService) canAccess(obj *model.GeoObjectWithGeometry, userID uuid.UUID, isAdmin bool) bool {
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
