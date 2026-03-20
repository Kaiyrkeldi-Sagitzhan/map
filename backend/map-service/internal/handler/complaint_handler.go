package handler

import (
	"net/http"
	"strconv"

	"map-service/internal/dto"
	"map-service/internal/middleware"
	"map-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ComplaintHandler handles HTTP requests for complaints
type ComplaintHandler struct {
	service *service.ComplaintService
}

// NewComplaintHandler creates a new ComplaintHandler
func NewComplaintHandler(service *service.ComplaintService) *ComplaintHandler {
	return &ComplaintHandler{service: service}
}

// Create handles creating a new complaint
func (h *ComplaintHandler) Create(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
		})
		return
	}

	var req dto.CreateComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.service.Create(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to create complaint",
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// List handles listing complaints
func (h *ComplaintHandler) List(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.service.List(c.Request.Context(), status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to list complaints",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetByID handles getting a complaint by ID
func (h *ComplaintHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid complaint ID",
		})
		return
	}

	resp, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "complaint not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, dto.ErrorResponse{
			Error:   "not_found",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Update handles updating a complaint (admin only)
func (h *ComplaintHandler) Update(c *gin.Context) {
	if !middleware.IsAdmin(c) {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{
			Error:   "forbidden",
			Message: "Admin access required",
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: "Invalid complaint ID",
		})
		return
	}

	var req dto.UpdateComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.service.Update(c.Request.Context(), id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		switch err.Error() {
		case "complaint not found":
			status = http.StatusNotFound
		case "invalid complaint status":
			status = http.StatusBadRequest
		}
		c.JSON(status, dto.ErrorResponse{
			Error:   "error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetStats handles getting object statistics
func (h *ComplaintHandler) GetStats(c *gin.Context) {
	resp, err := h.service.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get statistics",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}
