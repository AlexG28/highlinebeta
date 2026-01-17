# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend-builder

WORKDIR /backend

# Install git for go mod download
RUN apk add --no-cache git

# Copy go mod files
COPY backend/go.mod backend/go.sum* ./

# Download dependencies
RUN go mod download

# Copy backend source
COPY backend/*.go ./

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o highline .

# Stage 3: Final runtime image
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS and docker CLI for remediation
RUN apk add --no-cache ca-certificates docker-cli

# Copy backend binary
COPY --from=backend-builder /backend/highline .

# Copy frontend build
COPY --from=frontend-builder /frontend/dist ./static

# Environment defaults
ENV PORT=8080
ENV STATIC_DIR=/app/static
ENV HEARTBEAT_TIMEOUT=30s

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./highline"]
