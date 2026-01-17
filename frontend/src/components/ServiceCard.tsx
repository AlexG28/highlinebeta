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
      className={`bg-highline-card border ${config.border} rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer card-hover ${config.glow} ${isSelected ? 'ring-2 ring-highline-accent shadow-2xl' : ''} relative overflow-hidden group`}
      onClick={onClick}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-current/5 via-transparent to-current/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative z-10">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate group-hover:text-white transition-colors duration-300">{service.name}</h3>
          {service.github_repo && (
            <a
              href={service.github_repo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-highline-muted hover:text-highline-accent transition-colors truncate block mt-1 group-hover:translate-x-1 transform duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="inline-block mr-1">🔗</span>
              {service.github_repo.replace('https://github.com/', '')}
            </a>
          )}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${config.bg} ${config.color} border border-current/20 group-hover:scale-105 transition-transform duration-300`}>
          <div className="status-indicator w-2 h-2 rounded-full bg-current"></div>
          <span className="text-xs font-semibold">{config.label}</span>
        </div>
      </div>

      {/* Uptime bar */}
      <div className="mb-5 relative z-10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-highline-muted font-medium">Uptime</span>
          <span className={`${config.color} font-mono font-semibold`}>{service.uptime_percent.toFixed(2)}%</span>
        </div>
        <div className="h-3 bg-highline-border rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              service.uptime_percent >= 99 ? 'bg-gradient-to-r from-highline-accent to-green-400' :
              service.uptime_percent >= 95 ? 'bg-gradient-to-r from-highline-warning to-yellow-400' : 'bg-gradient-to-r from-highline-error to-red-400'
            } relative`}
            style={{ width: `${Math.min(service.uptime_percent, 100)}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5 relative z-10">
        <div className="bg-highline-bg/50 rounded-lg p-3 border border-highline-border/50 hover:border-highline-border transition-colors duration-300 group/stat">
          <div className="text-[10px] text-highline-muted uppercase tracking-wider font-semibold mb-1">Last Heartbeat</div>
          <div className="text-sm font-mono group-hover/stat:text-highline-accent transition-colors">{timeAgo}</div>
        </div>
        <div className="bg-highline-bg/50 rounded-lg p-3 border border-highline-border/50 hover:border-highline-border transition-colors duration-300 group/stat">
          <div className="text-[10px] text-highline-muted uppercase tracking-wider font-semibold mb-1">Total Checks</div>
          <div className="text-sm font-mono group-hover/stat:text-highline-accent transition-colors">{service.total_checks.toLocaleString()}</div>
        </div>
      </div>

      {/* Error log */}
      {service.last_error && (
        <div className="bg-highline-error/10 border border-highline-error/30 rounded-lg p-4 mb-3 relative z-10 group/error hover:bg-highline-error/15 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-highline-error">⚠️</span>
            <div className="text-[10px] text-highline-error uppercase tracking-wider font-semibold">Last Error</div>
          </div>
          <div className="text-xs text-highline-error/90 font-mono break-all line-clamp-3 group-hover/error:text-highline-error transition-colors">
            {service.last_error}
          </div>
        </div>
      )}

      {/* Remediation log */}
      {service.remediation_log && service.remediation_log.length > 0 && (
        <div className="bg-highline-accent/5 border border-highline-accent/20 rounded-lg p-4 relative z-10 group/remediation hover:bg-highline-accent/10 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-highline-accent">🔧</span>
            <div className="text-[10px] text-highline-accent uppercase tracking-wider font-semibold">Remediation Log</div>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {service.remediation_log.slice(-3).map((log, i) => (
              <div key={i} className="text-[10px] text-highline-muted font-mono group-hover/remediation:text-highline-accent/80 transition-colors">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover indicator */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-6 h-6 rounded-full bg-highline-accent/20 flex items-center justify-center">
          <svg className="w-3 h-3 text-highline-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
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
