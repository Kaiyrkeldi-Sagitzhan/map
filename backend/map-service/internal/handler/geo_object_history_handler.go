package handler

import (
	"log"
	"net/http"
	"strconv"

	"map-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GeoObjectHistoryHandler handles requests for geo object history
type GeoObjectHistoryHandler struct {
	service *service.GeoObjectHistoryService
}

// NewGeoObjectHistoryHandler creates a new instance
func NewGeoObjectHistoryHandler(s *service.GeoObjectHistoryService) *GeoObjectHistoryHandler {
	return &GeoObjectHistoryHandler{service: s}
}

// GetByObjectID handles GET /api/map/objects/:id/history
func (h *GeoObjectHistoryHandler) GetByObjectID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object id"})
		return
	}

	// Get the object to find its base_id for history retrieval
	obj, err := h.service.GetObjectByID(c.Request.Context(), id.String())
	if err != nil {
		log.Printf("[ERROR] Failed to get object %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve object"})
		return
	}

	limit := 50
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil {
			limit = l
		}
	}

	objectID := obj.BaseID
	if objectID == uuid.Nil {
		if parsed, err := uuid.Parse(obj.ID); err == nil {
			objectID = parsed
		} else {
			log.Printf("[ERROR] Invalid object ID format: %s", obj.ID)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid object id format"})
			return
		}
	}

	history, err := h.service.GetByObjectID(c.Request.Context(), objectID, limit)
	if err != nil {
		log.Printf("[ERROR] Failed to get history for object %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve history"})
		return
	}

	c.JSON(http.StatusOK, history)
}

// Rollback handles POST /api/map/history/:historyId/rollback
func (h *GeoObjectHistoryHandler) Rollback(c *gin.Context) {
	historyIDStr := c.Param("historyId")
	historyID, err := uuid.Parse(historyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid history id"})
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

	err = h.service.Rollback(c.Request.Context(), historyID, userID)
	if err != nil {
		log.Printf("[ERROR] Failed to rollback history %s: %v", historyID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "object restored successfully"})
}
