import { Service } from '../types';

interface ServiceLogsProps {
  service: Service;
  onClose: () => void;
}

export default function ServiceLogs({ service, onClose }: ServiceLogsProps) {
  // Use logs from backend, sorted newest first
  const logs = buildLogTimeline(service);

  return (
    <div className="mt-6 bg-highline-card border border-highline-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-highline-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-highline-accent/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-highline-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium">{service.name}</h3>
            <p className="text-xs text-highline-muted">Activity Log</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-highline-muted hover:text-white hover:bg-highline-border rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-highline-muted uppercase tracking-wider border-b border-highline-border">
              <th className="px-5 py-3 w-48">Timestamp</th>
              <th className="px-5 py-3 w-24">Type</th>
              <th className="px-5 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-highline-border/50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-highline-muted">
                  No logs available for this service yet.
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <LogRow key={index} log={log} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-highline-border bg-highline-bg/50 text-xs text-highline-muted">
        Showing {logs.length} log entries
      </div>
    </div>
  );
}

interface DisplayLogEntry {
  timestamp: Date;
  type: 'heartbeat' | 'error' | 'remediation' | 'status';
  message: string;
  eventType?: string;
  details?: Record<string, unknown>;
}

function LogRow({ log }: { log: DisplayLogEntry }) {
  const typeConfig = {
    heartbeat: { color: 'text-highline-accent', bg: 'bg-highline-accent/10', label: 'Heartbeat' },
    error: { color: 'text-highline-error', bg: 'bg-highline-error/10', label: 'Error' },
    remediation: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Remediation' },
    status: { color: 'text-highline-warning', bg: 'bg-highline-warning/10', label: 'Status' },
  };

  const eventTypeConfig: Record<string, { icon: string; label: string }> = {
    text_message: { icon: '💬', label: 'Text' },
    file_upload: { icon: '📁', label: 'Upload' },
    file_upload_failed: { icon: '🔴', label: 'Failed' },
  };

  const config = typeConfig[log.type] || typeConfig.status;
  const eventConfig = log.eventType ? eventTypeConfig[log.eventType] : null;

  return (
    <tr className="hover:bg-highline-border/20 transition-colors">
      <td className="px-5 py-3 font-mono text-sm text-highline-muted whitespace-nowrap">
        {formatTimestamp(log.timestamp)}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
            {config.label}
          </span>
          {eventConfig && (
            <span className="text-xs text-highline-muted">
              {eventConfig.icon} {eventConfig.label}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-sm">
        <div className="font-mono break-all">{log.message}</div>
        {log.details && Object.keys(log.details).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {formatDetails(log.details)}
          </div>
        )}
      </td>
    </tr>
  );
}

function formatDetails(details: Record<string, unknown>): JSX.Element[] {
  const badges: JSX.Element[] = [];
  
  // Show specific fields as badges
  if (details.user) {
    badges.push(
      <span key="user" className="inline-flex items-center px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs">
        @{String(details.user)}
      </span>
    );
  }
  
  if (details.filesize_mb !== undefined) {
    const size = Number(details.filesize_mb);
    const isLarge = size > 100;
    badges.push(
      <span key="size" className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${isLarge ? 'bg-highline-error/10 text-highline-error' : 'bg-highline-border text-highline-muted'}`}>
        {size.toFixed(1)} MB
      </span>
    );
  }
  
  if (details.filename) {
    badges.push(
      <span key="file" className="inline-flex items-center px-2 py-0.5 rounded bg-highline-border text-highline-muted text-xs font-mono">
        {String(details.filename)}
      </span>
    );
  }
  
  if (details.message_length) {
    badges.push(
      <span key="len" className="inline-flex items-center px-2 py-0.5 rounded bg-highline-border text-highline-muted text-xs">
        {String(details.message_length)} chars
      </span>
    );
  }
  
  return badges;
}

function buildLogTimeline(service: Service): DisplayLogEntry[] {
  // If we have logs from the backend, use those
  if (service.logs && service.logs.length > 0) {
    const displayLogs: DisplayLogEntry[] = service.logs.map(log => ({
      timestamp: new Date(log.timestamp),
      type: log.type,
      message: log.message,
      eventType: log.event_type,
      details: log.details as Record<string, unknown> | undefined,
    }));
    // Sort by timestamp descending (newest first)
    displayLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return displayLogs;
  }

  // Fallback: build from individual fields for backwards compatibility
  const logs: DisplayLogEntry[] = [];

  // Add last heartbeat as a log entry
  if (service.last_heartbeat) {
    logs.push({
      timestamp: new Date(service.last_heartbeat),
      type: 'heartbeat',
      message: `Service reported status: ${service.status}`,
    });
  }

  // Add last error if present
  if (service.last_error) {
    logs.push({
      timestamp: new Date(service.last_heartbeat || Date.now()),
      type: 'error',
      message: service.last_error,
    });
  }

  // Add remediation logs
  if (service.remediation_log) {
    for (const entry of service.remediation_log) {
      // Parse timestamp from log entry (format: "2024-01-15T10:30:00Z - Message")
      const match = entry.match(/^(\d{4}-\d{2}-\d{2}T[\d:]+(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s*-\s*(.+)$/);
      if (match) {
        logs.push({
          timestamp: new Date(match[1]),
          type: 'remediation',
          message: match[2],
        });
      } else {
        logs.push({
          timestamp: new Date(),
          type: 'remediation',
          message: entry,
        });
      }
    }
  }

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return logs;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
