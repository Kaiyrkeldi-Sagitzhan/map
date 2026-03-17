package model

import (
	"time"

	"github.com/google/uuid"
)

// Complaint represents a user complaint about a geographic object
type Complaint struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	ObjectID    *uuid.UUID `json:"object_id,omitempty" db:"object_id"`
	ObjectType  string     `json:"object_type" db:"object_type"`
	Description string     `json:"description" db:"description"`
	Status      string     `json:"status" db:"status"`
	AdminNotes  string     `json:"admin_notes" db:"admin_notes"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// ComplaintWithUser includes user email for display
type ComplaintWithUser struct {
	Complaint
	UserEmail string `json:"user_email" db:"user_email"`
	ObjectName string `json:"object_name,omitempty" db:"object_name"`
}

// Complaint status constants
const (
	ComplaintStatusPending   = "pending"
	ComplaintStatusInReview  = "in_review"
	ComplaintStatusResolved  = "resolved"
	ComplaintStatusDismissed = "dismissed"
)

// IsValidComplaintStatus checks if the status is valid
func IsValidComplaintStatus(status string) bool {
	switch status {
	case ComplaintStatusPending, ComplaintStatusInReview, ComplaintStatusResolved, ComplaintStatusDismissed:
		return true
	}
	return false
}
