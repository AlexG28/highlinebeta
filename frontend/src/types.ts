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
