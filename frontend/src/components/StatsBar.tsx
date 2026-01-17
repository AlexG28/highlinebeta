interface StatsBarProps {
  total: number;
  healthy: number;
  errors: number;
  down: number;
  avgUptime: number;
}

export default function StatsBar({ total, healthy, errors, down, avgUptime }: StatsBarProps) {
  if (total === 0) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <StatCard 
        label="Total Services" 
        value={total.toString()} 
        color="text-white"
      />
      <StatCard 
        label="Healthy" 
        value={healthy.toString()} 
        color="text-highline-accent"
        glow={healthy > 0}
      />
      <StatCard 
        label="Errors" 
        value={errors.toString()} 
        color="text-highline-warning"
        glow={errors > 0}
      />
      <StatCard 
        label="Down" 
        value={down.toString()} 
        color="text-highline-error"
        glow={down > 0}
      />
      <StatCard 
        label="Avg Uptime" 
        value={`${avgUptime.toFixed(1)}%`} 
        color={avgUptime >= 99 ? 'text-highline-accent' : avgUptime >= 95 ? 'text-highline-warning' : 'text-highline-error'}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  glow?: boolean;
}

function StatCard({ label, value, color, glow }: StatCardProps) {
  return (
    <div className={`bg-highline-card border border-highline-border rounded-xl p-4 ${glow ? 'ring-1 ring-current/20' : ''}`}>
      <div className="text-highline-muted text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
