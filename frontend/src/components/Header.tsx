interface HeaderProps {
  currentTime: Date;
  connected: boolean;
}

export default function Header({ currentTime, connected }: HeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-highline-accent/20 to-highline-accent/5 border border-highline-accent/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-highline-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17L8 7L13 13L18 5L21 17" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="17" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold gradient-text">Highline</h1>
            <p className="text-highline-muted text-sm">Uptime Monitoring</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="text-highline-muted font-mono">
            {formatTime(currentTime)}
          </div>
          <div className="flex items-center gap-2 text-highline-muted">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-highline-accent animate-pulse' : 'bg-highline-error'}`} />
            <span>{connected ? 'Live' : 'Disconnected'}</span>
            {connected && (
              <>
                <span className="text-highline-border mx-1">|</span>
                <span>WebSocket</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
