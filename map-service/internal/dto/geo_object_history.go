package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObjectHistoryResponse represents a history entry sent to the client
type GeoObjectHistoryResponse struct {
	ID             uuid.UUID        `json:"id"`
	ObjectID       uuid.UUID        `json:"objectId"`
	UserID         uuid.UUID        `json:"userId"`
	Action         string           `json:"action"`
	Description    string           `json:"description"`
	BeforeSnapshot *json.RawMessage `json:"beforeSnapshot,omitempty"`
	AfterSnapshot  *json.RawMessage `json:"afterSnapshot,omitempty"`
	CreatedAt      time.Time        `json:"createdAt"`
}

// RollbackResponse represents the result of a rollback operation
type RollbackResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
