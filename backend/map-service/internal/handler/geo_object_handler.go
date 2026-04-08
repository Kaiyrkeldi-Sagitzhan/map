package handler

import (
	"log"
	"net/http"
	"strconv"

	"map-service/internal/dto"
	"map-service/internal/middleware"
	"map-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GeoObjectHandler handles HTTP requests for geo objects
type GeoObjectHandler struct {
	service *service.GeoObjectService
}

// NewGeoObjectHandler creates a new GeoObjectHandler instance
func NewGeoObjectHandler(service *service.GeoObjectService) *GeoObjectHandler {
	return &GeoObjectHandler{service: service}
}

// Create handles creating a new geo object
func (h *GeoObjectHandler) Create(c *gin.Context) {
	var req dto.CreateGeoObjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	resp, err := h.service.Create(c.Request.Context(), userID, &req, canEdit)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"

		switch err.Error() {
		case "invalid scope":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		case "invalid object type":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		case "access denied":
			status = http.StatusForbidden
			errorMsg = "forbidden"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GetByID handles getting a geo object by ID
func (h *GeoObjectHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")

	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	resp, err := h.service.GetByID(c.Request.Context(), idStr, userID, canEdit)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"

		switch err.Error() {
		case "object not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		case "access denied":
			status = http.StatusForbidden
			errorMsg = "forbidden"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetVersions handles getting all versions of a geo object by base_id
func (h *GeoObjectHandler) GetVersions(c *gin.Context) {
	baseIDStr := c.Param("base_id")
	baseID, err := uuid.Parse(baseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid base ID",
		})
		return
	}

	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	resp, err := h.service.GetAllVersionsByBaseID(c.Request.Context(), baseID, userID, canEdit)
	if err != nil {
		log.Printf("[ERROR] GetVersions failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to retrieve versions",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetAll handles getting all accessible geo objects
func (h *GeoObjectHandler) GetAll(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	// Get type filter from query parameter
	objType := c.Query("type")
	search := c.Query("search")

	// Get bbox parameters
	minLatStr := c.Query("minLat")
	minLngStr := c.Query("minLng")
	maxLatStr := c.Query("maxLat")
	maxLngStr := c.Query("maxLng")
	zoomStr := c.Query("zoom")

	// Collect metadata filters (params starting with meta_)
	metaFilters := make(map[string]string)
	for k, v := range c.Request.URL.Query() {
		if len(k) > 5 && k[:5] == "meta_" {
			metaFilters[k[5:]] = v[0]
		}
	}

	var resp *dto.GeoObjectListResponse
	var err error

	if minLatStr != "" && minLngStr != "" && maxLatStr != "" && maxLngStr != "" {
		minLat, _ := strconv.ParseFloat(minLatStr, 64)
		minLng, _ := strconv.ParseFloat(minLngStr, 64)
		maxLat, _ := strconv.ParseFloat(maxLatStr, 64)
		maxLng, _ := strconv.ParseFloat(maxLngStr, 64)
		zoom, _ := strconv.Atoi(zoomStr)
		if zoomStr == "" {
			zoom = 10 // default
		}
		clip := c.Query("clip") == "true"
		filterByZoom := c.Query("filterByZoom") != "false" // default true

		resp, err = h.service.GetInBBox(c.Request.Context(), userID, canEdit, objType, minLat, minLng, maxLat, maxLng, zoom, clip, filterByZoom, search, metaFilters)
	} else {
		resp, err = h.service.GetAll(c.Request.Context(), userID, canEdit, objType, search, metaFilters)
	}

	if err != nil {
		log.Printf("[ERROR] GetAll failed: %v (type=%s, bbox=%s,%s,%s,%s zoom=%s)", err, objType, minLatStr, minLngStr, maxLatStr, maxLngStr, zoomStr)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to retrieve objects",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Update handles updating a geo object
func (h *GeoObjectHandler) Update(c *gin.Context) {
	idStr := c.Param("id")

	var req dto.UpdateGeoObjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	resp, err := h.service.Update(c.Request.Context(), idStr, userID, canEdit, &req)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"

		switch err.Error() {
		case "object not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		case "invalid scope":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		case "invalid object type":
			status = http.StatusBadRequest
			errorMsg = "validation_error"
		case "access denied":
			status = http.StatusForbidden
			errorMsg = "forbidden"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Delete handles deleting a geo object
func (h *GeoObjectHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid object ID",
		})
		return
	}

	userID, _ := middleware.GetUserID(c)
	canEdit := middleware.CanEdit(c)

	err = h.service.Delete(c.Request.Context(), id, userID, canEdit)
	if err != nil {
		status := http.StatusInternalServerError
		errorMsg := "internal_error"

		switch err.Error() {
		case "object not found":
			status = http.StatusNotFound
			errorMsg = "not_found"
		case "access denied":
			status = http.StatusForbidden
			errorMsg = "forbidden"
		}

		c.JSON(status, dto.ErrorResponse{
			Error:   errorMsg,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.SuccessResponse{
		Message: "Object deleted successfully",
	})
}

// HealthCheck returns the health status of the service
func (h *GeoObjectHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "map-service",
	})
}

// GetTile handles requests for vector tiles (MVT/PBF)
func (h *GeoObjectHandler) GetTile(c *gin.Context) {
	z, _ := strconv.Atoi(c.Param("z"))
	x, _ := strconv.Atoi(c.Param("x"))
	y, _ := strconv.Atoi(c.Param("y"))

	log.Printf("[DEBUG] Tile request: z=%d, x=%d, y=%d", z, x, y)

	tile, err := h.service.GetTile(c.Request.Context(), z, x, y)
	if err != nil {
		log.Printf("[ERROR] Failed to get tile %d/%d/%d: %v", z, x, y, err)
		c.Status(http.StatusInternalServerError)
		return
	}

	if tile == nil {
		log.Printf("[DEBUG] Tile %d/%d/%d is empty", z, x, y)
		c.Status(http.StatusNoContent)
		return
	}

	c.Header("Content-Type", "application/x-protobuf")
	c.Data(http.StatusOK, "application/x-protobuf", tile)
}
