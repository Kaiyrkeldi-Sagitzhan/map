package model

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         string    `json:"role" db:"role"`
	FirstName    string    `json:"first_name" db:"first_name"`
	LastName     string    `json:"last_name" db:"last_name"`
	Nickname     string    `json:"nickname" db:"nickname"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// UserRole constants
const (
	RoleAdmin  = "admin"
	RoleExpert = "expert"
	RoleUser   = "user"
)

// IsAdmin checks if the user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// IsExpert checks if the user has expert role
func (u *User) IsExpert() bool {
	return u.Role == RoleExpert
}

// CanEdit checks if the user can access the editor (admin or expert)
func (u *User) CanEdit() bool {
	return u.Role == RoleAdmin || u.Role == RoleExpert
}

// IsValidRole checks if the role is valid
func IsValidRole(role string) bool {
	return role == RoleAdmin || role == RoleExpert || role == RoleUser
}
