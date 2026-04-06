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

// SendUserUpdateNotification sends a notification email when admin updates user data
func (s *EmailService) SendUserUpdateNotification(email, adminName string, changes []string) error {
	log.Printf("=== SENDING USER UPDATE NOTIFICATION TO %s ===\n", email)
	log.Printf("Admin: %s\n", adminName)
	log.Printf("Changes: %v\n", changes)
	log.Printf("=====================================\n")

	err := s.sendEmail(email, "Your FreshMap Account Has Been Updated", s.buildUserUpdateNotificationEmail(adminName, changes))
	if err != nil {
		log.Printf("Failed to send user update notification to %s: %v\n", email, err)
		return err
	}

	log.Printf("User update notification sent successfully to %s\n", email)
	return nil
}

// SendUserDeletionNotification sends a notification email when admin deletes user account
func (s *EmailService) SendUserDeletionNotification(email, adminName string) error {
	log.Printf("=== SENDING USER DELETION NOTIFICATION TO %s ===\n", email)
	log.Printf("Admin: %s\n", adminName)
	log.Printf("=====================================\n")

	err := s.sendEmail(email, "Your FreshMap Account Has Been Deleted", s.buildUserDeletionNotificationEmail(adminName))
	if err != nil {
		log.Printf("Failed to send user deletion notification to %s: %v\n", email, err)
		return err
	}

	log.Printf("User deletion notification sent successfully to %s\n", email)
	return nil
}

// buildUserUpdateNotificationEmail builds the HTML email content for user update notification
func (s *EmailService) buildUserUpdateNotificationEmail(adminName string, changes []string) string {
	changesList := ""
	for _, change := range changes {
		changesList += fmt.Sprintf("<li>%s</li>", change)
	}

	return fmt.Sprintf(`
		<html>
		<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #020C1B; color: white;">
			<div style="max-width: 600px; margin: 0 auto; padding: 30px; background: rgba(2, 12, 27, 0.75); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.3);">
				<h2 style="color: #10B981; text-align: center;">FreshMap Account Updated</h2>
				<p style="color: #94a3b8;">Your account has been updated by an administrator.</p>

				<div style="margin: 20px 0; padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 10px;">
					<p style="margin: 0; color: #10B981;"><strong>Administrator:</strong> %s</p>
				</div>

				<p style="color: #94a3b8;">The following changes were made:</p>
				<ul style="color: #e2e8f0;">
					%s
				</ul>

				<p style="color: #64748b; font-size: 14px; margin-top: 30px;">
					If you have any questions, please contact support.
				</p>
			</div>
		</body>
		</html>
	`, adminName, changesList)
}

// buildUserDeletionNotificationEmail builds the HTML email content for user deletion notification
func (s *EmailService) buildUserDeletionNotificationEmail(adminName string) string {
	return fmt.Sprintf(`
		<html>
		<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #020C1B; color: white;">
			<div style="max-width: 600px; margin: 0 auto; padding: 30px; background: rgba(2, 12, 27, 0.75); border-radius: 20px; border: 1px solid rgba(239, 68, 68, 0.3);">
				<h2 style="color: #ef4444; text-align: center;">FreshMap Account Deleted</h2>
				<p style="color: #94a3b8;">Your account has been deleted by an administrator.</p>

				<div style="margin: 20px 0; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 10px;">
					<p style="margin: 0; color: #ef4444;"><strong>Administrator:</strong> %s</p>
				</div>

				<p style="color: #64748b; font-size: 14px; margin-top: 30px;">
					If you believe this was done in error, please contact support immediately.
				</p>

				<p style="color: #475569; font-size: 12px; margin-top: 20px;">
					This action is permanent and cannot be undone.
				</p>
			</div>
		</body>
		</html>
	`, adminName)
}
