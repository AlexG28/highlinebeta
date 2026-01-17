

interface StatsBarProps {
  total: number;
  healthy: number;
  errors: number;
  down: number;
  avgUptime: number;
  onStatClick: (type: 'total' | 'healthy' | 'errors' | 'down') => void;
}

export default function StatsBar({ total, healthy, errors, down, avgUptime, onStatClick }: StatsBarProps) {
  if (total === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
      <StatCard
        label="Total Services"
        value={total.toString()}
        color="text-white"
        icon="🔢"
        onClick={() => onStatClick('total')}
      />
      <StatCard
        label="Healthy"
        value={healthy.toString()}
        color="text-highline-accent"
        glow={healthy > 0}
        icon="✅"
        animate={healthy > 0}
        onClick={() => onStatClick('healthy')}
      />
      <StatCard
        label="Errors"
        value={errors.toString()}
        color="text-highline-warning"
        glow={errors > 0}
        icon="⚠️"
        animate={errors > 0}
        onClick={() => onStatClick('errors')}
      />
      <StatCard
        label="Down"
        value={down.toString()}
        color="text-highline-error"
        glow={down > 0}
        icon="❌"
        animate={down > 0}
        onClick={() => onStatClick('down')}
      />
      <StatCard
        label="Avg Uptime"
        value={`${avgUptime.toFixed(1)}%`}
        color={avgUptime >= 99 ? 'text-highline-accent' : avgUptime >= 95 ? 'text-highline-warning' : 'text-highline-error'}
        icon="📊"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  glow?: boolean;
  icon?: string;
  animate?: boolean;
  onClick?: () => void;
}

function StatCard({ label, value, color, glow, icon, animate, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-highline-card border border-highline-border rounded-xl p-5 card-hover group relative overflow-hidden ${glow ? 'ring-2 ring-current/20 glow-green' : ''} ${animate ? 'animate-pulse-slow' : ''} ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-current/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-highline-muted text-xs uppercase tracking-wider font-medium">{label}</div>
          {icon && <span className="text-lg opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>}
        </div>
        <div className={`text-3xl font-bold ${color} group-hover:scale-105 transition-transform duration-300`}>{value}</div>

        {/* Animated underline */}
        <div className="h-0.5 bg-gradient-to-r from-current/0 via-current/50 to-current/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center mt-2"></div>

        {/* Click indicator */}
        {onClick && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <svg className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
