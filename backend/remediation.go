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
	"github.com/docker/docker/pkg/stdcopy"
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
			"TERM=dumb",
			"GIT_AUTHOR_NAME=Highline AutoFix",
			"GIT_AUTHOR_EMAIL=autofix@highline.local",
			"GIT_COMMITTER_NAME=Highline AutoFix",
			"GIT_COMMITTER_EMAIL=autofix@highline.local",
			"REMEDIATION_ID=" + remediationID,
			"SERVICE_NAME=" + serviceName,
			"REPO_URL=" + repoURL,
			"BACKEND_URL=" + r.backendURL,
		},
		Entrypoint: []string{"/bin/sh", "-c"},
		Cmd:        []string{wrapperScript},
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

// streamContainerLogs streams container logs properly handling the Docker multiplexed stream
func (r *RemediationService) streamContainerLogs(ctx context.Context, containerID, remediationID string) {
	reader, err := r.dockerClient.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Timestamps: false,
	})
	if err != nil {
		return
	}
	defer reader.Close()

	// Use a pipe to convert the multiplexed stream into a readable format
	stdoutReader, stdoutWriter := io.Pipe()

	go func() {
		// StdCopy handles the 8-byte Docker headers correctly
		// It will split the multiplexed stream from reader into stdoutWriter and stderrWriter (we use same for both)
		_, err := stdcopy.StdCopy(stdoutWriter, stdoutWriter, reader)
		if err != nil {
			slog.Error("[REMEDIATION][LOG_ERROR]", "id", remediationID, "error", err)
		}
		stdoutWriter.Close()
	}()

	scanner := bufio.NewScanner(stdoutReader)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) != "" {
			slog.Info("[REMEDIATION][LOG]",
				"id", remediationID,
				"content", line,
			)
		}
	}
}

// buildAgentWrapperScript creates a shell script that runs OpenCode and reports back
func buildAgentWrapperScript(remediationID, serviceName, repoURL, errorLog, backendURL string) string {
	// Simple test prompt - focus only on code changes
	prompt := fmt.Sprintf(`
You are in a git repository. Your ONLY task is to go into the README and add a "hello world" at the very end. Thats it.

Error: %s

Guidelines:
1. DO NOT commit your changes.
2. DO NOT push your changes.
3. DO NOT create new branches.
Just add the hello world at the end`, strings.ReplaceAll(errorLog, "'", "'\"'\"'"))

	// Shell script that handles git mechanistically
	return fmt.Sprintf(`#!/bin/sh
set -x

echo "=== HIGHLINE AGENT STARTED ==="
echo "Remediation ID: %s"
echo "Service: %s"
echo "Repository: %s"
echo ""

# Pre-install essential dev tools
echo "=== INSTALLING DEV TOOLS ==="
if command -v apk >/dev/null; then
    apk add --no-cache git 
elif command -v apt-get >/dev/null; then
    apt-get update && apt-get install -y git
fi

# Configure OpenCode for Cerebras
echo "=== CONFIGURING OPENCODE ==="
mkdir -p $HOME/.config/opencode
cat > $HOME/.config/opencode/opencode.json << 'CONFIGEOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "cerebras/gpt-oss-120b",
  "provider": {
    "cerebras": {
      "api": "openai",
      "name": "Cerebras",
      "models": {
        "gpt-oss-120b": {
          "id": "gpt-oss-120b",
          "name": "OpenAI GPT-OSS 120B",
          "context_length": 131072
        }
      },
      "options": {
        "baseURL": "https://api.cerebras.ai/v1",
        "apiKey": "{env:CEREBRAS_API_KEY}"
      }
    }
  }
}
CONFIGEOF

# Setup workspace
mkdir -p /workspace
cd /workspace

# Mechanistically clone and setup
echo "=== MECHANISTIC SETUP ==="
# Strip https:// from repoURL for token auth
REPO_PATH=$(echo "%s" | sed 's|https://||')
git clone "https://x-access-token:$GITHUB_TOKEN@$REPO_PATH" repo
cd /workspace/repo

# Create a unique branch for this fix
BRANCH_NAME="highline-fix-%s"
git checkout -b "$BRANCH_NAME"

# Configure git identity
git config user.name "Highline AutoFix"
git config user.email "autofix@highline.local"

# Run OpenCode ONLY to fix the code
echo "=== RUNNING OPENCODE (EDIT MODE) ==="
opencode run '%s' 2>&1 || OPENCODE_EXIT=$?
OPENCODE_EXIT=${OPENCODE_EXIT:-0}

echo "=== CHECKING FOR CHANGES ==="
git status
CHANGES=$(git status --porcelain)

COMMIT_HASH=""
PUSHED="false"

if [ -n "$CHANGES" ]; then
    echo "Changes detected! Mechanistically committing and pushing..."
    git add .
    git commit -m "fix: automatically applied remediation for %s"
    COMMIT_HASH=$(git rev-parse HEAD)
    
    echo "Pushing to origin..."
    git push origin "$BRANCH_NAME" && PUSHED="true"
else
    echo "No changes were made by the agent."
fi

# Determine success
if [ -n "$COMMIT_HASH" ] && [ "$PUSHED" = "true" ]; then
    SUCCESS="true"
    SUMMARY="Successfully applied and pushed fix to branch $BRANCH_NAME"
else
    SUCCESS="false"
    SUMMARY="Failed to apply or push fix (exit: $OPENCODE_EXIT)"
fi

echo ""
echo "=== SENDING REPORT TO BACKEND ==="
echo "Reporting to: %s/api/remediation/report"
wget -qO- --post-data='{
        "remediation_id": "%s",
        "success": '$SUCCESS',
        "summary": "'"$SUMMARY"'",
        "commit_hash": "'"$COMMIT_HASH"'",
        "pushed": '$PUSHED',
        "files_changed": ["'$(echo "$CHANGES" | tr '\n' ',' | sed 's/,$//')'"],
        "logs": "OpenCode exit: '"$OPENCODE_EXIT"'"
    }' --header='Content-Type: application/json' "%s/api/remediation/report" || echo "Failed to send report (exit: $?)"

echo ""
echo "=== AGENT COMPLETE ==="

exit $OPENCODE_EXIT
`, remediationID, serviceName, repoURL, repoURL, remediationID, strings.ReplaceAll(prompt, "'", "'\"'\"'"), serviceName, backendURL, remediationID, backendURL)
}
