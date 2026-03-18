package dto

import (
	"github.com/google/uuid"
)

// CreateComplaintRequest represents request to create a complaint
type CreateComplaintRequest struct {
	ObjectID    *uuid.UUID `json:"object_id"`
	ObjectType  string     `json:"object_type" binding:"required"`
	Description string     `json:"description" binding:"required,min=1"`
}

// UpdateComplaintRequest represents request to update a complaint (admin)
type UpdateComplaintRequest struct {
	Status     string `json:"status"`
	AdminNotes string `json:"admin_notes"`
}

// ComplaintResponse represents a single complaint response
type ComplaintResponse struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	UserEmail   string     `json:"user_email"`
	ObjectID    *uuid.UUID `json:"object_id,omitempty"`
	ObjectType  string     `json:"object_type"`
	ObjectName  string     `json:"object_name,omitempty"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	AdminNotes  string     `json:"admin_notes,omitempty"`
	CreatedAt   string     `json:"created_at"`
	UpdatedAt   string     `json:"updated_at"`
}

// ComplaintListResponse represents paginated complaint list
type ComplaintListResponse struct {
	Complaints []ComplaintResponse `json:"complaints"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	Limit      int                 `json:"limit"`
}
