package main

import (
	"fmt"
	"sync"
	"time"
)

// ServiceStatus represents the current state of a monitored service
type ServiceStatus string

const (
	StatusHealthy ServiceStatus = "healthy"
	StatusError   ServiceStatus = "error"
	StatusDown    ServiceStatus = "down"
)

// LogEntry represents a single log entry for a service
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type"`      // "heartbeat", "error", "remediation", "status"
	Message   string                 `json:"message"`
	EventType string                 `json:"event_type,omitempty"` // e.g., "text_message", "file_upload"
	Details   map[string]interface{} `json:"details,omitempty"`    // structured data
}

// Service represents a monitored service
type Service struct {
	Name           string        `json:"name"`
	GitHubRepo     string        `json:"github_repo"`
	Status         ServiceStatus `json:"status"`
	LastHeartbeat  time.Time     `json:"last_heartbeat"`
	LastError      string        `json:"last_error,omitempty"`
	UptimePercent  float64       `json:"uptime_percent"`
	TotalChecks    int64         `json:"total_checks"`
	SuccessChecks  int64         `json:"success_checks"`
	RemediationLog []string      `json:"remediation_log,omitempty"`
	Logs           []LogEntry    `json:"logs,omitempty"`
}

// ServiceStore manages the in-memory storage of services
type ServiceStore struct {
	mu       sync.RWMutex
	services map[string]*Service
	timeout  time.Duration
}

// NewServiceStore creates a new service store
func NewServiceStore(timeout time.Duration) *ServiceStore {
	return &ServiceStore{
		services: make(map[string]*Service),
		timeout:  timeout,
	}
}

// LogData contains structured data for a log entry
type LogData struct {
	EventType string                 `json:"event_type,omitempty"` // e.g., "text_message", "file_upload"
	Details   map[string]interface{} `json:"details,omitempty"`    // flexible key-value data
}

// HeartbeatRequest represents an incoming heartbeat from a service
type HeartbeatRequest struct {
	ServiceName string   `json:"service_name"`
	GitHubRepo  string   `json:"github_repo"`
	Status      string   `json:"status"`
	ErrorLog    string   `json:"error_log,omitempty"`
	LogData     *LogData `json:"log_data,omitempty"` // structured log data
}

// RecordHeartbeat records a heartbeat for a service
func (s *ServiceStore) RecordHeartbeat(req HeartbeatRequest) *Service {
	s.mu.Lock()
	defer s.mu.Unlock()

	service, exists := s.services[req.ServiceName]
	if !exists {
		service = &Service{
			Name:          req.ServiceName,
			GitHubRepo:    req.GitHubRepo,
			TotalChecks:   0,
			SuccessChecks: 0,
			Logs:          make([]LogEntry, 0),
		}
		s.services[req.ServiceName] = service
	}

	// Update service info
	service.GitHubRepo = req.GitHubRepo
	service.LastHeartbeat = time.Now()
	service.TotalChecks++

	now := time.Now()

	if req.Status == "healthy" {
		service.Status = StatusHealthy
		service.SuccessChecks++
		service.LastError = ""
		
		// Build log message based on log data
		logMessage := "Service reported healthy"
		eventType := ""
		var details map[string]interface{}
		
		if req.LogData != nil {
			eventType = req.LogData.EventType
			details = req.LogData.Details
			logMessage = buildLogMessage(req.LogData)
		}
		
		// Add heartbeat log
		service.addLog(LogEntry{
			Timestamp: now,
			Type:      "heartbeat",
			Message:   logMessage,
			EventType: eventType,
			Details:   details,
		})
	} else {
		service.Status = StatusError
		service.LastError = req.ErrorLog
		
		// Build error message with details
		logMessage := req.ErrorLog
		eventType := ""
		var details map[string]interface{}
		
		if req.LogData != nil {
			eventType = req.LogData.EventType
			details = req.LogData.Details
			if logMessage == "" {
				logMessage = buildLogMessage(req.LogData)
			}
		}
		
		// Add error log
		service.addLog(LogEntry{
			Timestamp: now,
			Type:      "error",
			Message:   logMessage,
			EventType: eventType,
			Details:   details,
		})
	}

	// Calculate uptime percentage
	if service.TotalChecks > 0 {
		service.UptimePercent = float64(service.SuccessChecks) / float64(service.TotalChecks) * 100
	}

	return service
}

// addLog adds a log entry and keeps only the last 100 entries
func (svc *Service) addLog(entry LogEntry) {
	svc.Logs = append(svc.Logs, entry)
	// Keep only last 100 entries
	if len(svc.Logs) > 100 {
		svc.Logs = svc.Logs[len(svc.Logs)-100:]
	}
}

// buildLogMessage creates a human-readable message from log data
func buildLogMessage(data *LogData) string {
	if data == nil {
		return "Event received"
	}
	
	switch data.EventType {
	case "text_message":
		if user, ok := data.Details["user"].(string); ok {
			if msgLen, ok := data.Details["message_length"].(float64); ok {
				return fmt.Sprintf("Text message from @%s (%d chars)", user, int(msgLen))
			}
			return fmt.Sprintf("Text message from @%s", user)
		}
		return "Text message received"
		
	case "file_upload":
		user, _ := data.Details["user"].(string)
		filename, _ := data.Details["filename"].(string)
		filesize, _ := data.Details["filesize_mb"].(float64)
		
		if user != "" && filename != "" {
			return fmt.Sprintf("File upload from @%s: %s (%.2f MB)", user, filename, filesize)
		}
		return "File upload received"
		
	case "file_upload_failed":
		user, _ := data.Details["user"].(string)
		filename, _ := data.Details["filename"].(string)
		filesize, _ := data.Details["filesize_mb"].(float64)
		reason, _ := data.Details["reason"].(string)
		
		if user != "" {
			return fmt.Sprintf("File upload FAILED from @%s: %s (%.2f MB) - %s", user, filename, filesize, reason)
		}
		return "File upload failed"
		
	default:
		return fmt.Sprintf("Event: %s", data.EventType)
	}
}

// GetService returns a specific service by name
func (s *ServiceStore) GetService(name string) (*Service, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	service, exists := s.services[name]
	if !exists {
		return nil, false
	}

	// Return a copy to avoid race conditions
	copy := *service
	return &copy, true
}

// GetAllServices returns all services
func (s *ServiceStore) GetAllServices() []Service {
	s.mu.RLock()
	defer s.mu.RUnlock()

	services := make([]Service, 0, len(s.services))
	for _, service := range s.services {
		services = append(services, *service)
	}
	return services
}

// CheckTimeouts checks for services that haven't sent heartbeats within the timeout
// Returns services that just went down (for remediation)
func (s *ServiceStore) CheckTimeouts() []*Service {
	s.mu.Lock()
	defer s.mu.Unlock()

	var downServices []*Service
	now := time.Now()

	for _, service := range s.services {
		if service.Status != StatusDown && now.Sub(service.LastHeartbeat) > s.timeout {
			service.Status = StatusDown
			service.TotalChecks++
			// Recalculate uptime
			if service.TotalChecks > 0 {
				service.UptimePercent = float64(service.SuccessChecks) / float64(service.TotalChecks) * 100
			}
			// Add status change log
			service.addLog(LogEntry{
				Timestamp: now,
				Type:      "status",
				Message:   "Service marked as DOWN - heartbeat timeout",
			})
			downServices = append(downServices, service)
		}
	}

	return downServices
}

// AddRemediationLog adds a remediation log entry to a service
func (s *ServiceStore) AddRemediationLog(serviceName string, log string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if service, exists := s.services[serviceName]; exists {
		service.RemediationLog = append(service.RemediationLog, log)
		// Keep only last 10 entries
		if len(service.RemediationLog) > 10 {
			service.RemediationLog = service.RemediationLog[len(service.RemediationLog)-10:]
		}
		
		// Also add to the unified log
		service.addLog(LogEntry{
			Timestamp: time.Now(),
			Type:      "remediation",
			Message:   log,
		})
	}
}
