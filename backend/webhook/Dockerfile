FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go mod init webhook && go build -o webhook .

FROM alpine:3.19
RUN apk add --no-cache bash git docker-cli
WORKDIR /app
COPY --from=builder /app/webhook .
EXPOSE 9000
CMD ["./webhook"]
