# Highline - Uptime Monitoring with Auto-Remediation

A lightweight uptime monitoring system that uses AI (OpenCode) to automatically fix failing services.

## Features

- **Real-time WebSocket Updates**: Instant status changes via WebSocket connection
- **Simple Heartbeat Protocol**: Services send periodic heartbeats to report health status
- **Beautiful Dashboard**: Clean, modern UI showing service status and uptime metrics
- **Auto-Remediation**: When a service fails, OpenCode automatically analyzes the error and attempts to fix it
- **Single Container**: Frontend and backend combined into one unified container

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A GitHub Personal Access Token (for auto-remediation)
- An Anthropic API Key (for OpenCode AI)

### Setup

1. Clone the repository:
```bash
cd highlinebeta
```

2. Create your environment file with your credentials:
```bash
echo "GITHUB_PAT=ghp_your_token_here" > .env
echo "ANTHROPIC_API_KEY=sk-ant-your_key_here" >> .env
```

3. Start the service:
```bash
docker-compose up -d --build
```

4. Access the dashboard at [http://localhost:8080](http://localhost:8080)

## Usage

### Sending Heartbeats

Services should send heartbeats to the monitoring endpoint:

**Healthy heartbeat:**
```bash
curl -X POST http://localhost:8080/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "user-service",
    "github_repo": "https://github.com/your-org/user-service",
    "status": "healthy"
  }'
```

**Error heartbeat (triggers remediation):**
```bash
curl -X POST http://localhost:8080/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "user-service",
    "github_repo": "https://github.com/your-org/user-service",
    "status": "error",
    "error_log": "panic: nil pointer dereference at main.go:45"
  }'
```

### Heartbeat Protocol

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_name` | string | Yes | Unique identifier for the service |
| `github_repo` | string | No | GitHub repository URL (required for auto-remediation) |
| `status` | string | Yes | Either `"healthy"` or `"error"` |
| `error_log` | string | No | Error details when status is `"error"` |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/heartbeat` | POST | Receive heartbeat from a service |
| `/api/services` | GET | List all registered services |
| `/api/services/{name}` | GET | Get details for a specific service |
| `/api/health` | GET | Health check for the monitoring service itself |
| `/ws` | WebSocket | Real-time updates for the dashboard |

## Architecture

```
┌─────────────────┐     heartbeat     ┌──────────────────────────────┐
│  Your Services  │ ───────────────▶ │      Highline Container       │
└─────────────────┘                   │  ┌────────────────────────┐  │
                                      │  │   Go Backend (8080)    │  │
┌─────────────────┐    WebSocket      │  │  - REST API            │  │
│    Dashboard    │ ◀──────────────── │  │  - WebSocket server    │  │
│    (Browser)    │                   │  │  - Static file server  │  │
└─────────────────┘                   │  └────────────────────────┘  │
                                      └──────────────┬───────────────┘
                                                     │ on failure
                                                     ▼
┌─────────────────┐     fix + push    ┌──────────────────┐
│     GitHub      │ ◀──────────────── │    OpenCode      │
└─────────────────┘                   └──────────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |
| `HEARTBEAT_TIMEOUT` | `30s` | Time before a service is marked as down |
| `GITHUB_PAT` | - | GitHub Personal Access Token |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for OpenCode |
| `OPENCODE_IMAGE` | `ghcr.io/anomalyco/opencode:latest` | Docker image for OpenCode |

## Development

### Running locally (without Docker)

**Terminal 1 - Backend:**
```bash
cd backend
go mod download
go run .
```

**Terminal 2 - Frontend (dev server with hot reload):**
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on port 3000 and proxies API/WebSocket requests to the backend on port 8080.

### Testing with Fake Logger

Use the included fake log generator to test the system:

```bash
cd tools
pip install -r requirements.txt
python fake_logger.py --interval 1.0
```

This simulates a Twitter-like service sending text messages, file uploads, and occasional failures.

## License

MIT
