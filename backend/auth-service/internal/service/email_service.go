package service

import (
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

// EmailService handles email sending
type EmailService struct {
	smtpHost     string
	smtpPort     int
	smtpUsername string
	smtpPassword string
	smtpFrom     string
}

// NewEmailService creates a new EmailService
func NewEmailService(host string, port int, username, password, from string) *EmailService {
	return &EmailService{
		smtpHost:     host,
		smtpPort:     port,
		smtpUsername: username,
		smtpPassword: password,
		smtpFrom:     from,
	}
}

// SendVerificationCode sends a verification email with the code
func (s *EmailService) SendVerificationCode(email, code string) error {
	log.Printf("=== SENDING VERIFICATION CODE TO %s ===\n", email)
	log.Printf("Code: %s\n", code)
	log.Printf("SMTP Config - Host: %s, Port: %d, From: %s\n", s.smtpHost, s.smtpPort, s.smtpFrom)
	log.Printf("=====================================\n")

	err := s.sendEmail(email, "Your FreshMap Verification Code", s.buildVerificationEmail(code))
	if err != nil {
		log.Printf("Failed to send verification email to %s: %v\n", email, err)
		return err
	}

	log.Printf("Verification email sent successfully to %s\n", email)
	return nil
}

// sendEmail sends an actual email using SMTP
func (s *EmailService) sendEmail(to, subject, body string) error {
	if s.smtpUsername == "" || s.smtpPassword == "" {
		log.Println("SMTP not configured, email will only be logged")
		return nil
	}

	serverAddr := fmt.Sprintf("%s:%d", s.smtpHost, s.smtpPort)
	auth := smtp.PlainAuth("", s.smtpUsername, s.smtpPassword, s.smtpHost)

	headers := make(map[string]string)
	headers["From"] = s.smtpFrom
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=utf-8"

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	err := smtp.SendMail(serverAddr, auth, s.smtpFrom, []string{to}, []byte(msg.String()))
	if err != nil {
		log.Printf("Failed to send email: %v\n", err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("Email sent successfully to %s\n", to)
	return nil
}

// buildVerificationEmail builds the HTML email content
func (s *EmailService) buildVerificationEmail(code string) string {
	return fmt.Sprintf(`
		<html>
		<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #020C1B; color: white;">
			<div style="max-width: 600px; margin: 0 auto; padding: 30px; background: rgba(2, 12, 27, 0.75); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.3);">
				<h2 style="color: #10B981; text-align: center;">FreshMap Verification</h2>
				<p style="text-align: center; color: #94a3b8;">Your verification code is:</p>
				<div style="text-align: center; margin: 30px 0;">
					<span style="font-size: 36px; font-weight: bold; color: #10B981; letter-spacing: 8px;">%s</span>
				</div>
				<h2 style="text-align: center; color: #64748b; font-size: 14px;">
					This code will expire in 10 minutes.
				</h2>
				<h2 style="text-align: center; color: #475569; font-size: 12px; margin-top: 30px;">
					If you didn't request this, please ignore this email.
				</h2>
			</div>
		</body>
		</html>
	`, code)
}
