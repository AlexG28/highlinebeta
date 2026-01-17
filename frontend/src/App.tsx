import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import ServiceCard from './components/ServiceCard';
import ServiceLogs from './components/ServiceLogs';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import ServiceListModal from './components/ServiceListModal';
import ErrorDetailsModal from './components/ErrorDetailsModal';
import Remediations from './components/Remediations';

type View = 'services' | 'remediations';

function App() {
  const { services, connected, error, reconnect } = useWebSocket();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [view, setView] = useState<View>('services');
  const [modalType, setModalType] = useState<'total' | 'healthy' | 'errors' | 'down' | null>(null);

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

  const handleStatClick = (type: 'total' | 'healthy' | 'errors' | 'down') => {
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
  };

  if (view === 'remediations') {
    return (
      <div className="min-h-screen grid-pattern">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Remediations onBack={() => setView('services')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-pattern relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-highline-accent/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-highline-accent/3 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <Header currentTime={currentTime} connected={connected} />

        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <StatsBar
            total={services.length}
            healthy={healthyCount}
            errors={errorCount}
            down={downCount}
            avgUptime={avgUptime}
            onStatClick={handleStatClick}
          />

          <button
            onClick={() => setView('remediations')}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-highline-accent/20 to-highline-accent/10 border border-highline-accent/30 rounded-xl hover:border-highline-accent/50 transition-all duration-300 card-hover group"
          >
            <svg className="w-5 h-5 text-highline-accent group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <span className="text-sm font-medium">Remediations</span>
          </button>
        </div>

        {!connected && error ? (
          <div className="bg-highline-card border border-highline-error/30 rounded-2xl p-8 text-center card-hover relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-highline-error/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-highline-error/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-highline-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-highline-error mb-2 text-xl font-semibold">Connection Error</div>
              <div className="text-highline-muted text-sm mb-6 max-w-md mx-auto">
                {error}
              </div>
              <button
                onClick={reconnect}
                className="btn-primary px-6 py-3 rounded-xl font-medium hover:scale-105 transition-transform"
              >
                Reconnect
              </button>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-highline-card border border-highline-border rounded-2xl p-12 text-center card-hover relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-highline-accent/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-highline-border/50 flex items-center justify-center">
                <svg className="w-10 h-10 text-highline-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-2xl mb-3 font-semibold">No Services Registered</div>
              <div className="text-highline-muted text-sm max-w-lg mx-auto mb-6 leading-relaxed">
                Services will appear here once they start sending heartbeats to the monitoring endpoint.
              </div>
              <div className="bg-highline-bg rounded-xl p-6 text-left max-w-lg mx-auto border border-highline-border/50">
                <div className="text-xs text-highline-muted mb-3 font-medium">Send a heartbeat:</div>
                <code className="text-xs text-highline-accent font-mono bg-highline-card/50 p-3 rounded-lg block border border-highline-border/30">
                  curl -X POST http://localhost:8080/heartbeat \&lt;br/&gt;
                  &nbsp;&nbsp;-H "Content-Type: application/json" \&lt;br/&gt;
                  &nbsp;&nbsp;-d '&#123;"service_name":"my-service","status":"healthy"&#125;'
                </code>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Modals */}
      {modalType === 'total' && (
        <ServiceListModal
          title="All Services"
          services={services}
          onClose={closeModal}
          emptyMessage="No services registered"
        />
      )}

      {modalType === 'healthy' && (
        <ServiceListModal
          title="Healthy Services"
          services={services.filter(s => s.status === 'healthy')}
          onClose={closeModal}
          emptyMessage="No healthy services"
        />
      )}

      {modalType === 'down' && (
        <ServiceListModal
          title="Down Services"
          services={services.filter(s => s.status === 'down')}
          onClose={closeModal}
          emptyMessage="No services are down"
        />
      )}

      {modalType === 'errors' && (
        <ErrorDetailsModal
          services={services}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default App;
