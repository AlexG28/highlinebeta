package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/google/uuid"
)

// RemediationService handles spawning OpenCode containers for auto-fix
type RemediationService struct {
	dockerClient  *client.Client
	store         *RemediationStore
	githubPAT     string
	openCodeImage string
	cerebrasKey   string
	backendURL    string
}

// NewRemediationService creates a new remediation service
func NewRemediationService(store *RemediationStore) *RemediationService {
	dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		slog.Warn("Failed to create Docker client - remediation disabled", "error", err)
		return &RemediationService{store: store}
	}

	openCodeImage := os.Getenv("OPENCODE_IMAGE")
	if openCodeImage == "" {
		openCodeImage = "ghcr.io/anomalyco/opencode:latest"
	}

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://host.docker.internal:8080"
	}

	slog.Info("Remediation service initialized",
		"docker_client", "connected",
		"opencode_image", openCodeImage,
		"backend_url", backendURL,
		"github_pat_set", os.Getenv("GITHUB_PAT") != "",
		"cerebras_key_set", os.Getenv("CEREBRAS_API_KEY") != "",
	)

	githubPat := os.Getenv("GITHUB_PAT")
	key := os.Getenv("CEREBRAS_API_KEY")

	return &RemediationService{
		dockerClient:  dockerClient,
		store:         store,
		githubPAT:     githubPat,
		openCodeImage: openCodeImage,
		cerebrasKey:   key,
		backendURL:    backendURL,
	}
}

// RunOpenCode spawns an OpenCode container to analyze and fix issues
func (r *RemediationService) RunOpenCode(repoURL, errorLog, serviceName string) error {
	// Generate unique ID for this remediation
	remediationID := uuid.New().String()[:8]

	// Create record in store
	record := r.store.Create(remediationID, serviceName, repoURL, errorLog)

	slog.Info("[REMEDIATION] Starting remediation",
		"id", remediationID,
		"service", serviceName,
		"repo", repoURL,
	)

	// Validate prerequisites
	if r.dockerClient == nil {
		r.store.Complete(remediationID, false, -1, "Docker client not available")
		return fmt.Errorf("docker client not available")
	}

	if r.githubPAT == "" {
		r.store.Complete(remediationID, false, -1, "GITHUB_PAT not set")
		return fmt.Errorf("GITHUB_PAT environment variable not set")
	}

	if r.cerebrasKey == "" {
		r.store.Complete(remediationID, false, -1, "CEREBRAS_API_KEY not set")
		return fmt.Errorf("CEREBRAS_API_KEY environment variable not set")
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Pull the OpenCode image
	slog.Info("[REMEDIATION] Pulling OpenCode image",
		"id", remediationID,
		"image", r.openCodeImage,
	)

	reader, err := r.dockerClient.ImagePull(ctx, r.openCodeImage, image.PullOptions{})
	if err != nil {
		slog.Warn("[REMEDIATION] Failed to pull image, using local",
			"id", remediationID,
			"error", err,
		)
	} else {
		io.Copy(io.Discard, reader)
		reader.Close()
	}

	// Build the wrapper script that runs OpenCode and reports back
	wrapperScript := buildAgentWrapperScript(remediationID, serviceName, repoURL, errorLog, r.backendURL)

	// Container configuration
	containerName := fmt.Sprintf("highline-fix-%s", remediationID)

	r.store.UpdateStatus(remediationID, RemediationRunning, "", containerName)

	containerConfig := &container.Config{
		Image: r.openCodeImage,
		Env: []string{
			"GITHUB_TOKEN=" + r.githubPAT,
			"CEREBRAS_API_KEY=" + r.cerebrasKey,
			"GIT_AUTHOR_NAME=Highline AutoFix",
			"GIT_AUTHOR_EMAIL=autofix@highline.local",
			"GIT_COMMITTER_NAME=Highline AutoFix",
			"GIT_COMMITTER_EMAIL=autofix@highline.local",
			"REMEDIATION_ID=" + remediationID,
			"SERVICE_NAME=" + serviceName,
			"REPO_URL=" + repoURL,
			"BACKEND_URL=" + r.backendURL,
		},
		Cmd: []string{
			"/bin/sh", "-c", wrapperScript,
		},
		WorkingDir: "/workspace",
		Tty:        false,
	}

	hostConfig := &container.HostConfig{
		AutoRemove: false,
		Resources: container.Resources{
			Memory:   2 * 1024 * 1024 * 1024,
			NanoCPUs: 2 * 1e9,
		},
		// Allow container to reach host network for callback
		ExtraHosts: []string{"host.docker.internal:host-gateway"},
	}

	// Create the container
	slog.Info("[REMEDIATION] Creating container",
		"id", remediationID,
		"container_name", containerName,
	)

	resp, err := r.dockerClient.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		r.store.Complete(remediationID, false, -1, fmt.Sprintf("Failed to create container: %v", err))
		return fmt.Errorf("failed to create container: %w", err)
	}

	r.store.UpdateStatus(remediationID, RemediationRunning, resp.ID, containerName)
	record.ContainerID = resp.ID

	slog.Info("[REMEDIATION] Container created",
		"id", remediationID,
		"container_id", resp.ID[:12],
	)

	// Ensure cleanup
	// defer r.cleanupContainer(context.Background(), resp.ID, containerName, remediationID)

	// Start the container
	if err := r.dockerClient.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		r.store.Complete(remediationID, false, -1, fmt.Sprintf("Failed to start container: %v", err))
		return fmt.Errorf("failed to start container: %w", err)
	}

	slog.Info("[REMEDIATION] Container started - OpenCode agent is working",
		"id", remediationID,
		"container_id", resp.ID[:12],
	)

	// Stream logs in background
	go r.streamContainerLogs(ctx, resp.ID, remediationID)

	// Wait for completion
	statusCh, errCh := r.dockerClient.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)

	select {
	case err := <-errCh:
		if err != nil {
			r.store.Complete(remediationID, false, -1, fmt.Sprintf("Error waiting: %v", err))
			return fmt.Errorf("error waiting for container: %w", err)
		}

	case status := <-statusCh:
		success := status.StatusCode == 0
		r.store.Complete(remediationID, success, status.StatusCode, "")

		if success {
			slog.Info("[REMEDIATION] Container completed successfully",
				"id", remediationID,
				"exit_code", 0,
			)
		} else {
			slog.Error("[REMEDIATION] Container failed",
				"id", remediationID,
				"exit_code", status.StatusCode,
			)
			return fmt.Errorf("container exited with code %d", status.StatusCode)
		}

	case <-ctx.Done():
		r.store.SetTimedOut(remediationID)
		slog.Error("[REMEDIATION] Timeout - stopping container",
			"id", remediationID,
		)
		stopTimeout := 10
		r.dockerClient.ContainerStop(context.Background(), resp.ID, container.StopOptions{Timeout: &stopTimeout})
		return fmt.Errorf("remediation timed out")
	}

	return nil
}

// cleanupContainer removes the container
func (r *RemediationService) cleanupContainer(ctx context.Context, containerID, containerName, remediationID string) {
	slog.Info("[REMEDIATION] Cleaning up container",
		"id", remediationID,
		"container_id", containerID[:12],
	)

	err := r.dockerClient.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: true,
	})

	if err != nil {
		slog.Warn("[REMEDIATION] Failed to remove container",
			"id", remediationID,
			"error", err,
		)
	} else {
		slog.Info("[REMEDIATION] Container removed",
			"id", remediationID,
		)
	}
}

// streamContainerLogs streams container logs
func (r *RemediationService) streamContainerLogs(ctx context.Context, containerID, remediationID string) {
	reader, err := r.dockerClient.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Timestamps: true,
	})
	if err != nil {
		return
	}
	defer reader.Close()

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) > 8 {
			cleanLine := line[8:]
			if strings.TrimSpace(cleanLine) != "" {
				slog.Info("[REMEDIATION][LOG]",
					"id", remediationID,
					"content", cleanLine,
				)
			}
		}
	}
}

// buildAgentWrapperScript creates a shell script that runs OpenCode and reports back
func buildAgentWrapperScript(remediationID, serviceName, repoURL, errorLog, backendURL string) string {
	// Simple test prompt - just adds hello world to README
	prompt := fmt.Sprintf(`
Repository: %s

Your task is simple:
1. Clone the repo: git clone %s /workspace/repo
2. cd /workspace/repo
3. Add "hello world" to the very end of README.md
4. Commit: git commit -am "test: added hello world"
5. Push: git push

GITHUB_TOKEN is set for authentication. That's it - just add hello world to the README and push.`, repoURL, repoURL)

	// Shell script that:
	// 1. Runs OpenCode with the prompt
	// 2. Captures the result
	// 3. Sends a report back to the backend
	return fmt.Sprintf(`#!/bin/sh
set -e

echo "=== HIGHLINE AGENT STARTED ==="
echo "Remediation ID: %s"
echo "Service: %s"
echo "Repository: %s"
echo ""

# Configure OpenCode
mkdir -p ~/.config/opencode
cat <<EOF > ~/.config/opencode/opencode.json
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "cerebras/llama-3.3-70b",
  "provider": {
    "cerebras": {
      "models": {
        "llama-3.3-70b": {
          "id": "llama-3.3-70b"
        }
      },
      "options": {
        "apiKey": "{env:CEREBRAS_API_KEY}"
      }
    }
  }
}
EOF

# Create workspace
mkdir -p /workspace
cd /workspace

# Run OpenCode
echo "=== RUNNING OPENCODE ==="
OPENCODE_OUTPUT=$(opencode --print --dangerously-skip-permissions '%s' 2>&1) || OPENCODE_EXIT=$?
OPENCODE_EXIT=${OPENCODE_EXIT:-0}

echo ""
echo "=== OPENCODE FINISHED (exit: $OPENCODE_EXIT) ==="

# Check if repo was cloned and has commits
COMMIT_HASH=""
FILES_CHANGED=""
PUSHED="false"

if [ -d "/workspace/repo/.git" ]; then
    cd /workspace/repo
    COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")
    FILES_CHANGED=$(git diff --name-only HEAD~1 2>/dev/null | tr '\n' ',' || echo "")
    
    # Check if we pushed
    if git log --oneline -1 2>/dev/null | grep -q "fix:"; then
        PUSHED="true"
    fi
fi

# Determine success
if [ "$OPENCODE_EXIT" -eq 0 ] && [ -n "$COMMIT_HASH" ]; then
    SUCCESS="true"
    SUMMARY="Successfully analyzed and attempted fix"
else
    SUCCESS="false"
    SUMMARY="Failed to complete fix"
fi

echo ""
echo "=== SENDING REPORT TO BACKEND ==="

# Send report back to backend
curl -X POST "%s/api/remediation/report" \
    -H "Content-Type: application/json" \
    -d '{
        "remediation_id": "%s",
        "success": '$SUCCESS',
        "summary": "'"$SUMMARY"'",
        "commit_hash": "'"$COMMIT_HASH"'",
        "pushed": '$PUSHED',
        "files_changed": ["'"$FILES_CHANGED"'"],
        "logs": "OpenCode exit code: '"$OPENCODE_EXIT"'"
    }' 2>/dev/null || echo "Failed to send report"

echo ""
echo "=== AGENT COMPLETE ==="

exit $OPENCODE_EXIT
`, remediationID, serviceName, repoURL, strings.ReplaceAll(prompt, "'", "'\"'\"'"), backendURL, remediationID)
}
