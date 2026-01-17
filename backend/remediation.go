package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
)

// RemediationService handles spawning OpenCode containers for auto-fix
type RemediationService struct {
	dockerClient *client.Client
	githubPAT    string
	openCodeImage string
	anthropicKey  string
}

// NewRemediationService creates a new remediation service
func NewRemediationService() *RemediationService {
	dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		slog.Warn("Failed to create Docker client - remediation disabled", "error", err)
		return &RemediationService{}
	}

	openCodeImage := os.Getenv("OPENCODE_IMAGE")
	if openCodeImage == "" {
		openCodeImage = "ghcr.io/anomalyco/opencode:latest"
	}

	return &RemediationService{
		dockerClient:  dockerClient,
		githubPAT:     os.Getenv("GITHUB_PAT"),
		openCodeImage: openCodeImage,
		anthropicKey:  os.Getenv("ANTHROPIC_API_KEY"),
	}
}

// RunOpenCode spawns an OpenCode container to analyze and fix issues
func (r *RemediationService) RunOpenCode(repoURL, errorLog, serviceName string) error {
	if r.dockerClient == nil {
		return fmt.Errorf("docker client not available")
	}

	if r.githubPAT == "" {
		return fmt.Errorf("GITHUB_PAT environment variable not set")
	}

	if r.anthropicKey == "" {
		return fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	slog.Info("Pulling OpenCode image", "image", r.openCodeImage)

	// Pull the image
	reader, err := r.dockerClient.ImagePull(ctx, r.openCodeImage, image.PullOptions{})
	if err != nil {
		slog.Warn("Failed to pull image, attempting to use local", "error", err)
	} else {
		defer reader.Close()
		io.Copy(io.Discard, reader)
	}

	// Create the prompt for OpenCode
	prompt := fmt.Sprintf(`You are fixing an issue in a microservice. 

Service: %s
Repository: %s

The service has reported the following error:
%s

Please:
1. Clone the repository
2. Analyze the error and find the root cause
3. Fix the issue
4. Commit and push the fix

Use git commands to clone, commit, and push. The GITHUB_TOKEN environment variable is available for authentication.`, serviceName, repoURL, errorLog)

	// Container configuration
	containerConfig := &container.Config{
		Image: r.openCodeImage,
		Env: []string{
			"GITHUB_TOKEN=" + r.githubPAT,
			"ANTHROPIC_API_KEY=" + r.anthropicKey,
			"GIT_AUTHOR_NAME=Highline AutoFix",
			"GIT_AUTHOR_EMAIL=autofix@highline.local",
			"GIT_COMMITTER_NAME=Highline AutoFix",
			"GIT_COMMITTER_EMAIL=autofix@highline.local",
		},
		Cmd: []string{
			"opencode",
			"--print",
			"--dangerously-skip-permissions",
			prompt,
		},
		WorkingDir: "/workspace",
	}

	hostConfig := &container.HostConfig{
		AutoRemove: true,
		Resources: container.Resources{
			Memory: 2 * 1024 * 1024 * 1024, // 2GB
		},
	}

	containerName := fmt.Sprintf("highline-remediation-%s-%d", serviceName, time.Now().Unix())

	slog.Info("Creating remediation container",
		"container", containerName,
		"service", serviceName,
	)

	// Create container
	resp, err := r.dockerClient.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		return fmt.Errorf("failed to create container: %w", err)
	}

	// Start container
	if err := r.dockerClient.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start container: %w", err)
	}

	slog.Info("Remediation container started",
		"container_id", resp.ID,
		"service", serviceName,
	)

	// Wait for container to finish
	statusCh, errCh := r.dockerClient.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("error waiting for container: %w", err)
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			// Get container logs for debugging
			logs, _ := r.dockerClient.ContainerLogs(ctx, resp.ID, container.LogsOptions{
				ShowStdout: true,
				ShowStderr: true,
				Tail:       "50",
			})
			if logs != nil {
				logBytes, _ := io.ReadAll(logs)
				slog.Error("Container failed", "logs", string(logBytes))
				logs.Close()
			}
			return fmt.Errorf("container exited with status %d", status.StatusCode)
		}
	case <-ctx.Done():
		return fmt.Errorf("remediation timed out")
	}

	slog.Info("Remediation completed successfully",
		"service", serviceName,
	)

	return nil
}
