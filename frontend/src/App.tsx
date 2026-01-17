import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import ServiceCard from './components/ServiceCard';
import ServiceLogs from './components/ServiceLogs';
import Header from './components/Header';
import StatsBar from './components/StatsBar';

function App() {
  const { services, connected, error, reconnect } = useWebSocket();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedService, setSelectedService] = useState<string | null>(null);

  // Tick clock every second for consistent time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const errorCount = services.filter(s => s.status === 'error').length;
  const downCount = services.filter(s => s.status === 'down').length;
  const avgUptime = services.length > 0 
    ? services.reduce((acc, s) => acc + s.uptime_percent, 0) / services.length 
    : 100;

  const selectedServiceData = selectedService 
    ? services.find(s => s.name === selectedService) 
    : null;

  const handleServiceClick = (serviceName: string) => {
    setSelectedService(prev => prev === serviceName ? null : serviceName);
  };

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Header currentTime={currentTime} connected={connected} />
        
        <StatsBar 
          total={services.length}
          healthy={healthyCount}
          errors={errorCount}
          down={downCount}
          avgUptime={avgUptime}
        />

        {!connected && error ? (
          <div className="bg-highline-card border border-highline-error/30 rounded-xl p-6 text-center">
            <div className="text-highline-error mb-2">Connection Error</div>
            <div className="text-highline-muted text-sm">{error}</div>
            <button 
              onClick={reconnect}
              className="mt-4 px-4 py-2 bg-highline-error/20 text-highline-error rounded-lg hover:bg-highline-error/30 transition-colors"
            >
              Reconnect
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-highline-card border border-highline-border rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-highline-border flex items-center justify-center">
              <svg className="w-8 h-8 text-highline-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-xl mb-2">No Services Registered</div>
            <div className="text-highline-muted text-sm max-w-md mx-auto">
              Services will appear here once they start sending heartbeats to the monitoring endpoint.
            </div>
            <div className="mt-6 p-4 bg-highline-bg rounded-lg text-left max-w-lg mx-auto">
              <div className="text-xs text-highline-muted mb-2">Send a heartbeat:</div>
              <code className="text-xs text-highline-accent">
                curl -X POST http://localhost:8080/heartbeat \<br/>
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                &nbsp;&nbsp;-d '{`{"service_name":"my-service","status":"healthy"}`}'
              </code>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <ServiceCard 
                  key={service.name} 
                  service={service} 
                  isSelected={selectedService === service.name}
                  onClick={() => handleServiceClick(service.name)}
                  currentTime={currentTime}
                />
              ))}
            </div>
            
            {selectedServiceData && (
              <ServiceLogs 
                service={selectedServiceData} 
                onClose={() => setSelectedService(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
