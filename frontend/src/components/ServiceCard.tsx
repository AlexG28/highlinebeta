import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  isSelected?: boolean;
  onClick?: () => void;
  currentTime: Date;
}

export default function ServiceCard({ service, isSelected, onClick, currentTime }: ServiceCardProps) {
  const statusConfig = {
    healthy: {
      color: 'text-highline-accent',
      bg: 'bg-highline-accent/10',
      border: 'border-highline-accent/30',
      glow: 'glow-green',
      label: 'Healthy',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      color: 'text-highline-warning',
      bg: 'bg-highline-warning/10',
      border: 'border-highline-warning/30',
      glow: 'glow-yellow',
      label: 'Error',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    down: {
      color: 'text-highline-error',
      bg: 'bg-highline-error/10',
      border: 'border-highline-error/30',
      glow: 'glow-red',
      label: 'Down',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  };

  const config = statusConfig[service.status] || statusConfig.down;
  const lastHeartbeat = service.last_heartbeat ? new Date(service.last_heartbeat) : null;
  const timeAgo = lastHeartbeat ? getTimeAgo(lastHeartbeat, currentTime) : 'Never';

  return (
    <div 
      className={`bg-highline-card border ${config.border} rounded-xl p-5 transition-all hover:scale-[1.02] cursor-pointer ${config.glow} ${isSelected ? 'ring-2 ring-highline-accent' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium truncate">{service.name}</h3>
          {service.github_repo && (
            <a 
              href={service.github_repo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-highline-muted hover:text-highline-accent transition-colors truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              {service.github_repo.replace('https://github.com/', '')}
            </a>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg} ${config.color}`}>
          {config.icon}
          <span className="text-xs font-medium">{config.label}</span>
        </div>
      </div>

      {/* Uptime bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-highline-muted">Uptime</span>
          <span className={config.color}>{service.uptime_percent.toFixed(2)}%</span>
        </div>
        <div className="h-2 bg-highline-border rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              service.uptime_percent >= 99 ? 'bg-highline-accent' : 
              service.uptime_percent >= 95 ? 'bg-highline-warning' : 'bg-highline-error'
            }`}
            style={{ width: `${Math.min(service.uptime_percent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-highline-bg rounded-lg p-2">
          <div className="text-[10px] text-highline-muted uppercase tracking-wider">Last Heartbeat</div>
          <div className="text-sm">{timeAgo}</div>
        </div>
        <div className="bg-highline-bg rounded-lg p-2">
          <div className="text-[10px] text-highline-muted uppercase tracking-wider">Total Checks</div>
          <div className="text-sm">{service.total_checks.toLocaleString()}</div>
        </div>
      </div>

      {/* Error log */}
      {service.last_error && (
        <div className="bg-highline-error/10 border border-highline-error/20 rounded-lg p-3">
          <div className="text-[10px] text-highline-error uppercase tracking-wider mb-1">Last Error</div>
          <div className="text-xs text-highline-error/80 font-mono break-all line-clamp-3">
            {service.last_error}
          </div>
        </div>
      )}

      {/* Remediation log */}
      {service.remediation_log && service.remediation_log.length > 0 && (
        <div className="mt-3 bg-highline-accent/5 border border-highline-accent/20 rounded-lg p-3">
          <div className="text-[10px] text-highline-accent uppercase tracking-wider mb-1">Remediation Log</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {service.remediation_log.slice(-3).map((log, i) => (
              <div key={i} className="text-[10px] text-highline-muted font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date, currentTime: Date): string {
  const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
  
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
