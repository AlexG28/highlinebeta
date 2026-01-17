import { Service } from '../types';

interface ServiceLogsProps {
  service: Service;
  onClose: () => void;
}

export default function ServiceLogs({ service, onClose }: ServiceLogsProps) {
  // Use logs from backend, sorted newest first
  const logs = buildLogTimeline(service);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-highline-card border border-highline-border rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden card-hover relative">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-highline-accent/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-highline-border relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-highline-accent/10 flex items-center justify-center border border-highline-accent/20">
              <svg className="w-5 h-5 text-highline-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{service.name}</h3>
              <p className="text-xs text-highline-muted font-medium">Activity Timeline & Diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-highline-muted hover:text-white hover:bg-highline-border rounded-xl transition-all duration-300 hover:scale-110"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Log Table */}
        <div className="overflow-y-auto max-h-[60vh] relative z-10">
          <table className="w-full">
            <thead className="sticky top-0 bg-highline-card/95 backdrop-blur-sm">
              <tr className="text-left text-xs text-highline-muted uppercase tracking-wider border-b border-highline-border/50">
                <th className="px-6 py-4 w-48 font-semibold">Timestamp</th>
                <th className="px-6 py-4 w-24 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highline-border/30">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-highline-muted">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-highline-border/50 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium">No activity logs yet</div>
                    <div className="text-xs text-highline-muted/70 mt-1">Logs will appear here as the service sends heartbeats</div>
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
        <div className="px-6 py-4 border-t border-highline-border bg-highline-bg/50 text-xs text-highline-muted font-medium">
          <div className="flex items-center justify-between">
            <span>Showing {logs.length} log entries</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-highline-accent animate-pulse"></span>
              <span>Live updates enabled</span>
            </div>
          </div>
        </div>
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
    heartbeat: { color: 'text-highline-accent', bg: 'bg-highline-accent/10', border: 'border-highline-accent/20', label: 'Heartbeat', icon: '💓' },
    error: { color: 'text-highline-error', bg: 'bg-highline-error/10', border: 'border-highline-error/20', label: 'Error', icon: '⚠️' },
    remediation: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Remediation', icon: '🔧' },
    status: { color: 'text-highline-warning', bg: 'bg-highline-warning/10', border: 'border-highline-warning/20', label: 'Status', icon: '📊' },
  };

  const eventTypeConfig: Record<string, { icon: string; label: string }> = {
    text_message: { icon: '💬', label: 'Text' },
    file_upload: { icon: '📁', label: 'Upload' },
    file_upload_failed: { icon: '🔴', label: 'Failed' },
  };

  const config = typeConfig[log.type] || typeConfig.status;
  const eventConfig = log.eventType ? eventTypeConfig[log.eventType] : null;

  return (
    <tr className="hover:bg-highline-bg/30 transition-all duration-200 group">
      <td className="px-6 py-4 font-mono text-sm text-highline-muted whitespace-nowrap group-hover:text-white transition-colors">
        {formatTimestamp(log.timestamp)}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border} group-hover:scale-105 transition-transform duration-200`}>
            <span className="mr-1">{config.icon}</span>
            {config.label}
          </span>
          {eventConfig && (
            <span className="text-xs text-highline-muted bg-highline-border/50 px-2 py-1 rounded-lg">
              {eventConfig.icon} {eventConfig.label}
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm">
        <div className="font-mono break-all text-highline-muted group-hover:text-white transition-colors">{log.message}</div>
        {log.details && Object.keys(log.details).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
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
