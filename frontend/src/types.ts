export interface LogEntry {
  timestamp: string;
  type: 'heartbeat' | 'error' | 'remediation' | 'status';
  message: string;
  event_type?: string;
  details?: Record<string, unknown>;
}

export interface Service {
  name: string;
  github_repo: string;
  status: 'healthy' | 'error' | 'down';
  last_heartbeat: string;
  last_error?: string;
  uptime_percent: number;
  total_checks: number;
  success_checks: number;
  remediation_log?: string[];
  logs?: LogEntry[];
}

export type RemediationStatus = 'pending' | 'running' | 'success' | 'failed' | 'timed_out';

export interface AgentReport {
  remediation_id: string;
  success: boolean;
  summary: string;
  files_changed?: string[];
  commit_hash?: string;
  commit_message?: string;
  pushed: boolean;
  logs?: string;
  error_details?: string;
  timestamp: string;
}

export interface RemediationRecord {
  id: string;
  service_name: string;
  github_repo: string;
  error_log: string;
  status: RemediationStatus;
  container_id?: string;
  container_name?: string;
  start_time: string;
  end_time?: string;
  duration?: string;
  exit_code?: number;
  agent_report?: AgentReport;
  error_message?: string;
}
