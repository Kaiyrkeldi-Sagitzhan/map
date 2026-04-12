package handler

import (
	"log"
	"net/http"

	"map-service/internal/dto"
	"map-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GeoObjectVersionHandler handles requests for geo object versions
type GeoObjectVersionHandler struct {
	service *service.GeoObjectVersionService
}

// NewGeoObjectVersionHandler creates a new instance
func NewGeoObjectVersionHandler(s *service.GeoObjectVersionService) *GeoObjectVersionHandler {
	return &GeoObjectVersionHandler{service: s}
}

// GetByGeoObjectID handles GET /api/map/objects/:id/versions
func (h *GeoObjectVersionHandler) GetByGeoObjectID(c *gin.Context) {
	geoObjectIDStr := c.Param("id")
	geoObjectID, err := uuid.Parse(geoObjectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object ID"})
		return
	}

	versions, err := h.service.GetByGeoObjectID(c.Request.Context(), geoObjectID)
	if err != nil {
		log.Printf("[ERROR] Failed to get versions for object %s: %v", geoObjectIDStr, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve versions"})
		return
	}

	c.JSON(http.StatusOK, versions)
}

// Create handles POST /api/map/objects/:id/versions
func (h *GeoObjectVersionHandler) Create(c *gin.Context) {
	geoObjectID := c.Param("id")

	var req dto.CreateGeoObjectVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Override geoObjectID from URL
	req.GeoObjectID = geoObjectID

	userIDInterface, _ := c.Get("user_id")
	var userID uuid.UUID
	switch v := userIDInterface.(type) {
	case uuid.UUID:
		userID = v
	case string:
		userID, _ = uuid.Parse(v)
	}

	version, err := h.service.Create(c.Request.Context(), req, userID)
	if err != nil {
		log.Printf("[ERROR] Failed to create version for object %s: %v", geoObjectID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create version"})
		return
	}

	c.JSON(http.StatusCreated, version)
}

// RollbackToVersion handles POST /api/map/objects/:id/versions/rollback
func (h *GeoObjectVersionHandler) RollbackToVersion(c *gin.Context) {
	// Note: This handler is for versions, but rollback is in GeoObjectService
	// We need to call the geo object service, but this handler only has version service
	// This is a design issue. For now, we'll assume the rollback is handled elsewhere.
	// In a real implementation, the handler should have access to GeoObjectService

	c.JSON(http.StatusNotImplemented, gin.H{"error": "rollback not implemented in this handler"})
}

// CreateFromCurrent handles POST /api/map/objects/:id/versions/current
func (h *GeoObjectVersionHandler) CreateFromCurrent(c *gin.Context) {
	geoObjectID := c.Param("id")

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDInterface, _ := c.Get("user_id")
	var userID uuid.UUID
	switch v := userIDInterface.(type) {
	case uuid.UUID:
		userID = v
	case string:
		userID, _ = uuid.Parse(v)
	}

	version, err := h.service.CreateFromCurrentObject(c.Request.Context(), geoObjectID, req.Name, req.Description, userID)
	if err != nil {
		log.Printf("[ERROR] Failed to create version from current for object %s: %v", geoObjectID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create version"})
		return
	}

	c.JSON(http.StatusCreated, version)
}
