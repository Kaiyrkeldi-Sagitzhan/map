FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod .
COPY main.go .
RUN go build -o webhook .

FROM alpine:3.19
RUN apk add --no-cache bash git docker-cli docker-cli-compose
RUN git config --global --add safe.directory /home/ask/GitHub/map
WORKDIR /app
COPY --from=builder /app/webhook .
EXPOSE 9000
CMD ["./webhook"]
