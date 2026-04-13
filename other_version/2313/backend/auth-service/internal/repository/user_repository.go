package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"auth-service/internal/model"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrUserNotFound     = errors.New("user not found")
	ErrUserAlreadyExist = errors.New("user already exists")
)

// UserRepository handles user database operations
type UserRepository struct {
	db *sqlx.DB
}

// NewUserRepository creates a new UserRepository instance
func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user in the database
func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (id, email, password_hash, role, first_name, last_name, nickname, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.ExecContext(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.FirstName,
		user.LastName,
		user.Nickname,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrUserAlreadyExist
		}
		return err
	}

	return nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, role, first_name, last_name, nickname, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user model.User
	err := r.db.GetContext(ctx, &user, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, role, first_name, last_name, nickname, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user model.User
	err := r.db.GetContext(ctx, &user, query, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// Update updates a user in the database
func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	query := `
		UPDATE users
		SET email = $2, password_hash = $3, role = $4, first_name = $5, last_name = $6, nickname = $7, updated_at = $8
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.FirstName,
		user.LastName,
		user.Nickname,
		user.UpdatedAt,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrUserNotFound
	}

	return nil
}

// Delete deletes a user from the database
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		DELETE FROM users
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrUserNotFound
	}

	return nil
}

// ListUsers returns paginated users with optional search
func (r *UserRepository) ListUsers(ctx context.Context, search string, page, limit int) ([]model.User, error) {
	offset := (page - 1) * limit

	var users []model.User
	var err error

	if search != "" {
		query := `
			SELECT id, email, password_hash, role, first_name, last_name, nickname, created_at, updated_at
			FROM users
			WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR nickname ILIKE $1
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`
		searchPattern := fmt.Sprintf("%%%s%%", search)
		err = r.db.SelectContext(ctx, &users, query, searchPattern, limit, offset)
	} else {
		query := `
			SELECT id, email, password_hash, role, first_name, last_name, nickname, created_at, updated_at
			FROM users
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`
		err = r.db.SelectContext(ctx, &users, query, limit, offset)
	}

	if err != nil {
		return nil, err
	}

	return users, nil
}

// CountUsers returns total user count with optional search
func (r *UserRepository) CountUsers(ctx context.Context, search string) (int, error) {
	var count int
	var err error

	if search != "" {
		query := `
			SELECT COUNT(*) FROM users
			WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR nickname ILIKE $1
		`
		searchPattern := fmt.Sprintf("%%%s%%", search)
		err = r.db.GetContext(ctx, &count, query, searchPattern)
	} else {
		query := `SELECT COUNT(*) FROM users`
		err = r.db.GetContext(ctx, &count, query)
	}

	if err != nil {
		return 0, err
	}

	return count, nil
}

// isDuplicateKeyError checks if the error is a duplicate key error
func isDuplicateKeyError(err error) bool {
	return contains(err.Error(), "23505") || contains(err.Error(), "duplicate key")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
