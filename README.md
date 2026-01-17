# Highline

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/ghcr.io/anomalyco/opencode)](https://hub.docker.com/r/ghcr.io/anomalyco/opencode)

Highline is a lightweight **uptime monitoring** system powered by **AI (OpenCode)**. It automatically detects failing services, analyses the error, and attempts remediation – all while providing a modern, real‑time dashboard.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Sending Heartbeats](#sending-heartbeats)
  - [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Development](#development)
- [License](#license)

---

## Features

- **Real‑time WebSocket Updates** – instant status changes on the dashboard.
- **Simple Heartbeat Protocol** – services report health via a tiny HTTP payload.
- **Beautiful Dashboard** – clean UI built with modern web technologies.
- **Auto‑Remediation** – OpenCode analyses error logs and pushes fixes back to the repo.
- **All‑in‑One Container** – both frontend and backend run side‑by‑side.

---

## Quick Start

### Prerequisites

- Docker & Docker‑Compose
- GitHub Personal Access Token (PAT) – used by the auto‑remediation engine.
- Cerebras API Key – for the OpenCode AI.

### Setup

```bash
# Clone the repo (you are already here)
cd repo_highlinebeta

# Create an .env file with your credentials
cat <<EOF > .env
GITHUB_PAT=${{GITHUB_PAT:-your_token_here}}
CEREBRAS_API_KEY=${{CEREBRAS_API_KEY:-your_key_here}}
EOF

# Build and run the containers
docker-compose up -d --build
```

Open your browser at **http://localhost:8080** to view the dashboard.

---

## Usage

### Sending Heartbeats

Services should POST a JSON payload to `/heartbeat`.

#### Healthy heartbeat

```bash
curl -X POST http://localhost:8080/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "user-service",
    "github_repo": "https://github.com/your-org/user-service",
    "status": "healthy"
}'
```

#### Error heartbeat (triggers remediation)

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

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/heartbeat` | POST | Receive heartbeat from a service |
| `/api/services` | GET | List all registered services |
| `/api/services/{name}` | GET | Get details for a specific service |
| `/api/health` | GET | Health check for the monitoring service |
| `/ws` | WebSocket | Real‑time updates for the dashboard |

---

## Architecture

```
+-----------------+     heartbeat     +--------------------------+
| Your Services   | ----------------> | Highline Container       |
+-----------------+                   |  +--------------------+   |
                                      |  | Go Backend (8080) |   |
                                      |  | - REST API       |   |
                                      |  | - WebSocket      |   |
                                      |  +--------------------+   |
                                      |          |               |
                                      |   WebSocket                |
                                      v          v               |
                               +-------------------+   |
                               | Dashboard (Browser) |   |
                               +-------------------+   |
                                      ^                |
                                      |                |
                                      |   fix + push   |
                                      v                |
                               +-------------------+   |
                               | GitHub            |   |
                               +-------------------+   |
                                      ^                |
                                      | OpenCode AI    |
                                      +-------------------+
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |
| `HEARTBEAT_TIMEOUT` | `30s` | Time before a service is marked as down |
| `GITHUB_PAT` | – | GitHub Personal Access Token |
| `CEREBRAS_API_KEY` | – | Cerebras API key for OpenCode |
| `OPENCODE_IMAGE` | `ghcr.io/anomalyco/opencode:latest` | Docker image for OpenCode |

---

## Development

### Running locally (without Docker)

```bash
# Backend
cd backend
go mod download
go run .

# Frontend (hot‑reload)
cd ../frontend
npm install
npm run dev
```

The frontend dev server runs on **port 3000** and proxies API/WebSocket requests to the backend on **port 8080**.

### Testing with the Fake Logger

```bash
cd tools
pip install -r requirements.txt
python fake_logger.py --interval 1.0
```

The fake logger simulates a service emitting heartbeats, including occasional failures.

---

## License

MIT © 2024 AlexG28

hello world
