FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy source code (vendor included, no double-copy)
COPY . .

# Build the application using vendored dependencies (no internet needed)
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /auth-service ./cmd/main.go

# Final stage
FROM alpine:latest

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app

COPY --from=builder /auth-service .

EXPOSE 8081

CMD ["./auth-service"]
