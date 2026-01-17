package main

import (
	"sync"
	"time"
)

// RemediationStatus represents the current status of a remediation
type RemediationStatus string

const (
	RemediationPending    RemediationStatus = "pending"
	RemediationRunning    RemediationStatus = "running"
	RemediationSuccess    RemediationStatus = "success"
	RemediationFailed     RemediationStatus = "failed"
	RemediationTimedOut   RemediationStatus = "timed_out"
)

// RemediationRecord stores the full history of a remediation attempt
type RemediationRecord struct {
	ID            string            `json:"id"`
	ServiceName   string            `json:"service_name"`
	GitHubRepo    string            `json:"github_repo"`
	ErrorLog      string            `json:"error_log"`
	Status        RemediationStatus `json:"status"`
	ContainerID   string            `json:"container_id,omitempty"`
	ContainerName string            `json:"container_name,omitempty"`
	StartTime     time.Time         `json:"start_time"`
	EndTime       *time.Time        `json:"end_time,omitempty"`
	Duration      string            `json:"duration,omitempty"`
	ExitCode      *int64            `json:"exit_code,omitempty"`
	AgentReport   *AgentReport      `json:"agent_report,omitempty"`
	ErrorMessage  string            `json:"error_message,omitempty"`
}

// AgentReport is what the OpenCode agent sends back after completing
type AgentReport struct {
	RemediationID string    `json:"remediation_id"`
	Success       bool      `json:"success"`
	Summary       string    `json:"summary"`
	FilesChanged  []string  `json:"files_changed,omitempty"`
	CommitHash    string    `json:"commit_hash,omitempty"`
	CommitMessage string    `json:"commit_message,omitempty"`
	Pushed        bool      `json:"pushed"`
	Logs          string    `json:"logs,omitempty"`
	ErrorDetails  string    `json:"error_details,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// RemediationStore manages remediation history
type RemediationStore struct {
	mu      sync.RWMutex
	records map[string]*RemediationRecord
	order   []string // Track insertion order for listing
}

// NewRemediationStore creates a new remediation store
func NewRemediationStore() *RemediationStore {
	return &RemediationStore{
		records: make(map[string]*RemediationRecord),
		order:   make([]string, 0),
	}
}

// Create starts a new remediation record
func (s *RemediationStore) Create(id, serviceName, githubRepo, errorLog string) *RemediationRecord {
	s.mu.Lock()
	defer s.mu.Unlock()

	record := &RemediationRecord{
		ID:          id,
		ServiceName: serviceName,
		GitHubRepo:  githubRepo,
		ErrorLog:    errorLog,
		Status:      RemediationPending,
		StartTime:   time.Now(),
	}

	s.records[id] = record
	s.order = append(s.order, id)

	// Keep only last 100 records
	if len(s.order) > 100 {
		oldID := s.order[0]
		delete(s.records, oldID)
		s.order = s.order[1:]
	}

	return record
}

// UpdateStatus updates the status of a remediation
func (s *RemediationStore) UpdateStatus(id string, status RemediationStatus, containerID, containerName string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if record, exists := s.records[id]; exists {
		record.Status = status
		if containerID != "" {
			record.ContainerID = containerID
		}
		if containerName != "" {
			record.ContainerName = containerName
		}
	}
}

// Complete marks a remediation as completed
func (s *RemediationStore) Complete(id string, success bool, exitCode int64, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if record, exists := s.records[id]; exists {
		now := time.Now()
		record.EndTime = &now
		record.Duration = now.Sub(record.StartTime).Round(time.Second).String()
		record.ExitCode = &exitCode
		record.ErrorMessage = errorMsg

		if success {
			record.Status = RemediationSuccess
		} else {
			record.Status = RemediationFailed
		}
	}
}

// SetTimedOut marks a remediation as timed out
func (s *RemediationStore) SetTimedOut(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if record, exists := s.records[id]; exists {
		now := time.Now()
		record.EndTime = &now
		record.Duration = now.Sub(record.StartTime).Round(time.Second).String()
		record.Status = RemediationTimedOut
		record.ErrorMessage = "Remediation timed out after 10 minutes"
	}
}

// AddAgentReport adds the report from the OpenCode agent
func (s *RemediationStore) AddAgentReport(id string, report *AgentReport) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if record, exists := s.records[id]; exists {
		record.AgentReport = report
		return true
	}
	return false
}

// Get retrieves a single remediation record
func (s *RemediationStore) Get(id string) (*RemediationRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	record, exists := s.records[id]
	if !exists {
		return nil, false
	}

	// Return a copy
	copy := *record
	return &copy, true
}

// GetAll returns all remediation records (newest first)
func (s *RemediationStore) GetAll() []RemediationRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records := make([]RemediationRecord, 0, len(s.order))
	// Reverse order so newest is first
	for i := len(s.order) - 1; i >= 0; i-- {
		if record, exists := s.records[s.order[i]]; exists {
			records = append(records, *record)
		}
	}
	return records
}

// GetByService returns remediation records for a specific service
func (s *RemediationStore) GetByService(serviceName string) []RemediationRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records := make([]RemediationRecord, 0)
	for i := len(s.order) - 1; i >= 0; i-- {
		if record, exists := s.records[s.order[i]]; exists {
			if record.ServiceName == serviceName {
				records = append(records, *record)
			}
		}
	}
	return records
}
