import { Service } from '../types';

interface ServiceListModalProps {
  title: string;
  services: Service[];
  onClose: () => void;
  emptyMessage?: string;
}

export default function ServiceListModal({ title, services, onClose, emptyMessage }: ServiceListModalProps) {
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
      <div className="bg-highline-card border border-highline-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden card-hover relative">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-highline-accent/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-highline-border relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-highline-accent/10 flex items-center justify-center border border-highline-accent/20">
              <svg className="w-5 h-5 text-highline-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-xs text-highline-muted font-medium">{services.length} services</p>
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

        {/* Scrollable Service List */}
        <div className="overflow-y-auto max-h-[60vh] relative z-10">
          {services.length === 0 ? (
            <div className="px-6 py-12 text-center text-highline-muted">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-highline-border/50 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-5v2m0 0v2m0-2h2m-2 0h-2" />
                </svg>
              </div>
              <div className="text-sm font-medium">{emptyMessage || 'No services found'}</div>
            </div>
          ) : (
            <div className="divide-y divide-highline-border/30">
              {services.map((service) => (
                <ServiceListItem key={service.name} service={service} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceListItem({ service }: { service: Service }) {
  const statusConfig = {
    healthy: {
      color: 'text-highline-accent',
      bg: 'bg-highline-accent/10',
      border: 'border-highline-accent/30',
      label: 'Healthy',
      icon: '✅',
    },
    error: {
      color: 'text-highline-warning',
      bg: 'bg-highline-warning/10',
      border: 'border-highline-warning/30',
      label: 'Error',
      icon: '⚠️',
    },
    down: {
      color: 'text-highline-error',
      bg: 'bg-highline-error/10',
      border: 'border-highline-error/30',
      label: 'Down',
      icon: '❌',
    },
  };

  const config = statusConfig[service.status] || statusConfig.down;

  return (
    <div className="px-6 py-4 hover:bg-highline-bg/20 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-medium truncate">{service.name}</h4>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
              {config.icon} {config.label}
            </span>
          </div>
          <div className="text-xs text-highline-muted">
            Uptime: {service.uptime_percent.toFixed(1)}% • Last heartbeat: {service.last_heartbeat ? new Date(service.last_heartbeat).toLocaleString() : 'Never'}
          </div>
          {service.last_error && (
            <div className="text-xs text-highline-error/80 mt-1 truncate">
              Error: {service.last_error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}