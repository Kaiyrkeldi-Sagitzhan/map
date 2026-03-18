package service

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"sync"
	"time"
)

var (
	ErrInvalidCode     = errors.New("invalid verification code")
	ErrCodeExpired     = errors.New("verification code expired")
	ErrTooManyAttempts = errors.New("too many verification attempts")
)

// VerificationStore stores verification codes in memory
type VerificationStore struct {
	mu       sync.RWMutex
	codes    map[string]*verificationCode
	attempts map[string]int
}

type verificationCode struct {
	email     string
	code      string
	expiresAt time.Time
	verified  bool
}

// NewVerificationStore creates a new in-memory verification store
func NewVerificationStore() *VerificationStore {
	store := &VerificationStore{
		codes:    make(map[string]*verificationCode),
		attempts: make(map[string]int),
	}

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			store.cleanup()
		}
	}()

	return store
}

func (vs *VerificationStore) cleanup() {
	vs.mu.Lock()
	defer vs.mu.Unlock()

	now := time.Now()
	for key, vc := range vs.codes {
		if now.After(vc.expiresAt) {
			delete(vs.codes, key)
			delete(vs.attempts, key)
		}
	}
}

// global verification store
var verificationStore *VerificationStore

func init() {
	verificationStore = NewVerificationStore()
}

func getVerificationStore() *VerificationStore {
	return verificationStore
}

// VerificationService handles email verification
type VerificationService struct {
	store         *VerificationStore
	emailService  *EmailService
	codeLength    int
	expiryMinutes int
	maxAttempts   int
}

// NewVerificationService creates a new VerificationService
func NewVerificationService(emailService *EmailService) *VerificationService {
	return &VerificationService{
		store:         getVerificationStore(),
		emailService:  emailService,
		codeLength:    6,
		expiryMinutes: 10,
		maxAttempts:   5,
	}
}

// generateCode generates a random alphanumeric verification code
func (s *VerificationService) generateCode() (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, s.codeLength)
	for i := range code {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[num.Int64()]
	}
	return string(code), nil
}

// SendVerificationCode sends a verification code to the user's email
func (s *VerificationService) SendVerificationCode(ctx context.Context, email string) error {
	if s.store.getAttempts(email) >= s.maxAttempts {
		return ErrTooManyAttempts
	}

	code, err := s.generateCode()
	if err != nil {
		return err
	}

	s.store.setCode(email, code, time.Duration(s.expiryMinutes)*time.Minute)
	s.store.incrementAttempts(email)

	return s.emailService.SendVerificationCode(email, code)
}

// VerifyCode verifies the user's code
func (s *VerificationService) VerifyCode(ctx context.Context, email, code string) error {
	if s.store.getAttempts(email) >= s.maxAttempts {
		return ErrTooManyAttempts
	}

	vc := s.store.getCode(email)
	if vc == nil {
		return ErrInvalidCode
	}

	if time.Now().After(vc.expiresAt) {
		s.store.deleteCode(email)
		return ErrCodeExpired
	}

	if vc.code != code {
		s.store.incrementAttempts(email)
		return ErrInvalidCode
	}

	s.store.markVerified(email)
	return nil
}

// IsVerified checks if the email is verified
func (s *VerificationService) IsVerified(email string) bool {
	vc := s.store.getCode(email)
	return vc != nil && vc.verified
}

func (vs *VerificationStore) getAttempts(email string) int {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.attempts[email]
}

func (vs *VerificationStore) incrementAttempts(email string) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	vs.attempts[email]++
}

func (vs *VerificationStore) setCode(email, code string, expiry time.Duration) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	vs.codes[email] = &verificationCode{
		email:     email,
		code:      code,
		expiresAt: time.Now().Add(expiry),
		verified:  false,
	}
}

func (vs *VerificationStore) getCode(email string) *verificationCode {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.codes[email]
}

func (vs *VerificationStore) markVerified(email string) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	if vc, ok := vs.codes[email]; ok {
		vc.verified = true
	}
}

func (vs *VerificationStore) deleteCode(email string) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	delete(vs.codes, email)
	delete(vs.attempts, email)
}
