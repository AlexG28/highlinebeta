interface HeaderProps {
  currentTime: Date;
  connected: boolean;
}

export default function Header({ currentTime, connected }: HeaderProps) {
  return (
    <header className="mb-8 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-highline-accent/5 to-transparent rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-highline-accent/3 to-transparent rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-highline-accent/20 to-highline-accent/5 border border-highline-accent/30 flex items-center justify-center card-hover group">
            <svg className="w-7 h-7 text-highline-accent group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17L8 7L13 13L18 5L21 17" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="17" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text animate-pulse-glow">Highline</h1>
            <p className="text-highline-muted text-sm font-medium">Uptime Monitoring Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-highline-muted font-mono bg-highline-card/50 px-3 py-2 rounded-lg border border-highline-border/50">
            {formatTime(currentTime)}
          </div>
          <div className="flex items-center gap-3 text-highline-muted bg-highline-card/50 px-4 py-2 rounded-lg border border-highline-border/50">
            <div className={`w-3 h-3 rounded-full status-indicator ${connected ? 'bg-highline-accent pulse-glow' : 'bg-highline-error'}`} />
            <span className="font-medium">{connected ? 'Live Connection' : 'Disconnected'}</span>
            {connected && (
              <>
                <span className="text-highline-border mx-2">•</span>
                <span className="text-highline-accent font-mono text-xs">WebSocket</span>
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
