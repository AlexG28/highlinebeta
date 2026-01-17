package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
)

// HeartbeatHandler handles incoming heartbeats from services
func (app *App) HeartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("Failed to decode heartbeat request", "error", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ServiceName == "" {
		http.Error(w, "service_name is required", http.StatusBadRequest)
		return
	}

	service := app.store.RecordHeartbeat(req)

	slog.Info("Heartbeat received",
		"service", req.ServiceName,
		"status", req.Status,
		"github_repo", req.GitHubRepo,
	)

	// Broadcast update to all WebSocket clients
	app.BroadcastServiceUpdate(service)

	// If service reported an error, trigger remediation
	if req.Status == "error" && req.ErrorLog != "" && req.GitHubRepo != "" {
		slog.Warn("Service reported error, triggering remediation",
			"service", req.ServiceName,
			"error", req.ErrorLog,
		)
		go app.TriggerRemediation(service, req.ErrorLog)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"message": "Heartbeat recorded",
	})
}

// ServicesHandler returns all services
func (app *App) ServicesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	services := app.store.GetAllServices()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

// ServiceHandler returns a specific service
func (app *App) ServiceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract service name from path: /services/{name} or /api/services/{name}
	path := strings.TrimPrefix(r.URL.Path, "/api/services/")
	path = strings.TrimPrefix(path, "/services/")
	if path == "" {
		http.Error(w, "Service name required", http.StatusBadRequest)
		return
	}

	service, exists := app.store.GetService(path)
	if !exists {
		http.Error(w, "Service not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(service)
}

// HealthHandler returns the health status of the monitoring service itself
func (app *App) HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
	})
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Logging middleware
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slog.Debug("Request received",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
		)
		next.ServeHTTP(w, r)
	})
}
