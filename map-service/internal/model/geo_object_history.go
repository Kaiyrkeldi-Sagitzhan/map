package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoObjectHistory represents a record in the geo_object_history table
type GeoObjectHistory struct {
	ID             uuid.UUID        `db:"id" json:"id"`
	ObjectID       uuid.UUID        `db:"object_id" json:"objectId"`
	UserID         uuid.UUID        `db:"user_id" json:"userId"`
	Action         string           `db:"action" json:"action"`
	Description    string           `db:"description" json:"description"`
	BeforeSnapshot *json.RawMessage `db:"before_snapshot" json:"beforeSnapshot"`
	AfterSnapshot  *json.RawMessage `db:"after_snapshot" json:"afterSnapshot"`
	CreatedAt      time.Time        `db:"created_at" json:"createdAt"`
}
