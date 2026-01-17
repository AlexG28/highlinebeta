import { Service } from '../types';

interface ErrorDetailsModalProps {
  services: Service[];
  onClose: () => void;
}

export default function ErrorDetailsModal({ services, onClose }: ErrorDetailsModalProps) {
  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const errorServices = services.filter(s => s.status === 'error' || s.last_error);
  const errorCount = errorServices.length;

  // Group errors by message
  const errorGroups = errorServices.reduce((acc, service) => {
    const errorMsg = service.last_error || 'Unknown error';
    if (!acc[errorMsg]) {
      acc[errorMsg] = [];
    }
    acc[errorMsg].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-highline-card border border-highline-border rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden card-hover relative">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-highline-error/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-highline-border relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-highline-error/10 flex items-center justify-center border border-highline-error/20">
              <svg className="w-5 h-5 text-highline-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Error Details</h3>
              <p className="text-xs text-highline-muted font-medium">{errorCount} services with errors</p>
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

        {/* Scrollable Error Details */}
        <div className="overflow-y-auto max-h-[60vh] relative z-10">
          {errorCount === 0 ? (
            <div className="px-6 py-12 text-center text-highline-muted">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-highline-border/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-highline-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm font-medium">No errors detected</div>
              <div className="text-xs text-highline-muted/70 mt-1">All services are running normally</div>
            </div>
          ) : (
            <div className="divide-y divide-highline-border/30">
              {Object.entries(errorGroups).map(([errorMessage, affectedServices]) => (
                <ErrorGroup key={errorMessage} errorMessage={errorMessage} services={affectedServices} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-highline-border bg-highline-bg/50 text-xs text-highline-muted font-medium">
          <div className="flex items-center justify-between">
            <span>{errorCount} services affected by {Object.keys(errorGroups).length} unique errors</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-highline-error animate-pulse"></span>
              <span>Real-time monitoring</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorGroup({ errorMessage, services }: { errorMessage: string; services: Service[] }) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-highline-error">⚠️</span>
          <h4 className="font-medium text-highline-error">Error Message</h4>
          <span className="text-xs text-highline-muted bg-highline-error/10 px-2 py-1 rounded-full">
            {services.length} service{services.length !== 1 ? 's' : ''} affected
          </span>
        </div>
        <div className="bg-highline-error/5 border border-highline-error/20 rounded-lg p-3">
          <code className="text-sm text-highline-error/90 font-mono break-all">
            {errorMessage}
          </code>
        </div>
      </div>

      <div>
        <h5 className="text-sm font-medium text-highline-muted mb-3">Affected Services:</h5>
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between bg-highline-bg/50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{service.name}</div>
                <div className="text-xs text-highline-muted">
                  Last seen: {service.last_heartbeat ? new Date(service.last_heartbeat).toLocaleString() : 'Never'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-highline-error">
                  {service.uptime_percent.toFixed(1)}% uptime
                </div>
                <div className="text-xs text-highline-muted">
                  {service.total_checks} checks
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}