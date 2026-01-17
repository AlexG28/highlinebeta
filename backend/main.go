package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

// #region agent log
func debugLog(location, message, hypothesisId string, data map[string]interface{}) {
	payload := map[string]interface{}{
		"sessionId":    "debug-session",
		"runId":        "initial-debug",
		"hypothesisId": hypothesisId,
		"location":     location,
		"message":      message,
		"data":         data,
		"timestamp":    time.Now().UnixMilli(),
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post("http://host.docker.internal:7242/ingest/818bdc5c-c7d4-4800-bfc7-d2b244b48aae", "application/json", bytes.NewBuffer(body))
	if err == nil {
		resp.Body.Close()
	}
}

// #endregion

// App holds the application dependencies
type App struct {
	store            *ServiceStore
	remediation      *RemediationService
	remediationStore *RemediationStore
	wsHub            *WSHub
}

func main() {
	// Load .env file from root or current directory
	if err := godotenv.Load("../.env"); err != nil {
		if err := godotenv.Load(".env"); err != nil {
			slog.Info("No .env file found or error loading it, using system environment variables")
		}
	}

	// #region agent log
	cwd, _ := os.Getwd()
	debugLog("backend/main.go:22", "Main function entry", "H1,H3,H4", map[string]interface{}{
		"PORT":             os.Getenv("PORT"),
		"GITHUB_PAT_SET":   os.Getenv("GITHUB_PAT") != "",
		"CEREBRAS_KEY_SET": os.Getenv("CEREBRAS_API_KEY") != "",
		"STATIC_DIR":       os.Getenv("STATIC_DIR"),
		"CWD":              cwd,
		"ENV_COUNT":        len(os.Environ()),
	})
	// #endregion

	// Configure structured JSON logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting Highline Monitoring Service")

	// Get configuration from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	timeout := 30 * time.Second
	if t := os.Getenv("HEARTBEAT_TIMEOUT"); t != "" {
		if parsed, err := time.ParseDuration(t); err == nil {
			timeout = parsed
		}
	}

	// Initialize services
	store := NewServiceStore(timeout)
	remediationStore := NewRemediationStore()
	remediation := NewRemediationService(remediationStore)
	wsHub := NewWSHub()

	app := &App{
		store:            store,
		remediation:      remediation,
		remediationStore: remediationStore,
		wsHub:            wsHub,
	}

	// Setup routes
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("/api/heartbeat", app.HeartbeatHandler)
	mux.HandleFunc("/api/services", app.ServicesHandler)
	mux.HandleFunc("/api/services/", app.ServiceHandler)
	mux.HandleFunc("/api/health", app.HealthHandler)
	mux.HandleFunc("/api/remediations", app.RemediationsHandler)
	mux.HandleFunc("/api/remediations/", app.RemediationDetailHandler)
	mux.HandleFunc("/api/remediation/report", app.RemediationReportHandler)

	// Legacy endpoints (for backwards compatibility)
	mux.HandleFunc("/heartbeat", app.HeartbeatHandler)
	mux.HandleFunc("/health", app.HealthHandler)

	// WebSocket endpoint
	mux.Handle("/ws", app.WebSocketHandler())

	// Serve static frontend files
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./static"
	}

	// Check if static directory exists
	if _, err := os.Stat(staticDir); err == nil {
		slog.Info("Serving static files", "dir", staticDir)
		fileServer := http.FileServer(http.Dir(staticDir))
		mux.Handle("/", spaHandler(fileServer, staticDir))
	} else {
		slog.Warn("Static directory not found, frontend will not be served", "dir", staticDir)
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"ok","message":"Highline API - frontend not available"}`))
		})
	}

	// Apply middleware
	handler := corsMiddleware(loggingMiddleware(mux))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Start timeout checker in background
	ctx, cancel := context.WithCancel(context.Background())
	go app.runTimeoutChecker(ctx)

	// Start server in goroutine
	go func() {
		slog.Info("Server starting", "port", port, "heartbeat_timeout", timeout.String())
		err := server.ListenAndServe()
		// #region agent log
		debugLog("backend/main.go:113", "ListenAndServe returned", "H1", map[string]interface{}{"error": err.Error()})
		// #endregion
		if err != http.ErrServerClosed {
			slog.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")
	cancel()

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server shutdown error", "error", err)
	}

	slog.Info("Server stopped")
}

// runTimeoutChecker periodically checks for timed out services and updates uptime
func (app *App) runTimeoutChecker(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Check for newly timed out services
			downServices, updatedServices := app.store.CheckTimeoutsAndUpdateUptime()

			// Handle newly down services
			for _, service := range downServices {
				slog.Warn("Service timed out",
					"service", service.Name,
					"last_heartbeat", service.LastHeartbeat,
				)
				// Trigger remediation for timed out services
				go app.TriggerRemediation(service, "Service heartbeat timeout - no response received")
			}

			// Broadcast all updated services to WebSocket clients
			for _, service := range updatedServices {
				app.BroadcastServiceUpdate(service)
			}
		}
	}
}

// spaHandler wraps a file server to handle SPA routing
func spaHandler(fs http.Handler, staticDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := staticDir + r.URL.Path

		// Check if file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// Serve index.html for SPA routing
			http.ServeFile(w, r, staticDir+"/index.html")
			return
		}

		fs.ServeHTTP(w, r)
	})
}

// TriggerRemediation triggers the OpenCode remediation for a failed service
func (app *App) TriggerRemediation(service *Service, errorLog string) {
	if service.GitHubRepo == "" {
		slog.Warn("Cannot remediate service without GitHub repo", "service", service.Name)
		return
	}

	slog.Info("Triggering remediation",
		"service", service.Name,
		"github_repo", service.GitHubRepo,
		"error", errorLog,
	)

	app.store.AddRemediationLog(service.Name,
		time.Now().Format(time.RFC3339)+" - Remediation triggered: "+errorLog)

	// Broadcast update after adding remediation log
	if updated, ok := app.store.GetService(service.Name); ok {
		app.BroadcastServiceUpdate(updated)
	}

	err := app.remediation.RunOpenCode(service.GitHubRepo, errorLog, service.Name)
	if err != nil {
		slog.Error("Remediation failed",
			"service", service.Name,
			"error", err,
		)
		app.store.AddRemediationLog(service.Name,
			time.Now().Format(time.RFC3339)+" - Remediation failed: "+err.Error())
	} else {
		slog.Info("Remediation completed",
			"service", service.Name,
		)
		app.store.AddRemediationLog(service.Name,
			time.Now().Format(time.RFC3339)+" - Remediation completed successfully")
	}

	// Broadcast final update after remediation completes/fails
	if updated, ok := app.store.GetService(service.Name); ok {
		app.BroadcastServiceUpdate(updated)
	}
}
