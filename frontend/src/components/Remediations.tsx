import { useState, useEffect } from 'react';
import { RemediationRecord, RemediationStatus } from '../types';

interface RemediationsProps {
  onBack: () => void;
}

export default function Remediations({ onBack }: RemediationsProps) {
  const [remediations, setRemediations] = useState<RemediationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRemediations();
    const interval = setInterval(fetchRemediations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRemediations = async () => {
    try {
      const response = await fetch('/api/remediations');
      if (response.ok) {
        const data = await response.json();
        setRemediations(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch remediations:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedRemediation = selectedId 
    ? remediations.find(r => r.id === selectedId) 
    : null;

  const statusConfig: Record<RemediationStatus, { color: string; bg: string; label: string; icon: string }> = {
    pending: { color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Pending', icon: '⏳' },
    running: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Running', icon: '🔄' },
    success: { color: 'text-highline-accent', bg: 'bg-highline-accent/10', label: 'Success', icon: '✅' },
    failed: { color: 'text-highline-error', bg: 'bg-highline-error/10', label: 'Failed', icon: '❌' },
    timed_out: { color: 'text-highline-warning', bg: 'bg-highline-warning/10', label: 'Timed Out', icon: '⏰' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-highline-muted hover:text-white hover:bg-highline-border rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-semibold">Remediation Manager</h2>
            <p className="text-sm text-highline-muted">View OpenCode agent deployments</p>
          </div>
        </div>
        <div className="text-sm text-highline-muted">
          {remediations.length} total attempts
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-highline-muted">Loading...</div>
      ) : remediations.length === 0 ? (
        <div className="bg-highline-card border border-highline-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-highline-border flex items-center justify-center">
            <svg className="w-8 h-8 text-highline-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div className="text-xl mb-2">No Remediations Yet</div>
          <div className="text-highline-muted text-sm">
            When a service fails, OpenCode agents will be deployed automatically.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div className="space-y-3">
            {remediations.map((r) => {
              const config = statusConfig[r.status];
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={`bg-highline-card border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] ${
                    selectedId === r.id ? 'border-highline-accent ring-1 ring-highline-accent/30' : 'border-highline-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{r.service_name}</div>
                      <div className="text-xs text-highline-muted font-mono">{r.id}</div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg} ${config.color}`}>
                      <span>{config.icon}</span>
                      <span className="text-xs font-medium">{config.label}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-highline-bg rounded p-2">
                      <div className="text-highline-muted">Started</div>
                      <div>{new Date(r.start_time).toLocaleTimeString()}</div>
                    </div>
                    <div className="bg-highline-bg rounded p-2">
                      <div className="text-highline-muted">Duration</div>
                      <div>{r.duration || 'Running...'}</div>
                    </div>
                  </div>

                  {r.agent_report && (
                    <div className={`mt-2 text-xs px-2 py-1 rounded ${r.agent_report.success ? 'bg-highline-accent/10 text-highline-accent' : 'bg-highline-error/10 text-highline-error'}`}>
                      {r.agent_report.pushed ? '📤 Changes pushed' : r.agent_report.summary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail Panel */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            {selectedRemediation ? (
              <RemediationDetail remediation={selectedRemediation} statusConfig={statusConfig} />
            ) : (
              <div className="bg-highline-card border border-highline-border rounded-xl p-8 text-center text-highline-muted">
                Select a remediation to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RemediationDetailProps {
  remediation: RemediationRecord;
  statusConfig: Record<RemediationStatus, { color: string; bg: string; label: string; icon: string }>;
}

function RemediationDetail({ remediation, statusConfig }: RemediationDetailProps) {
  const config = statusConfig[remediation.status];

  return (
    <div className="bg-highline-card border border-highline-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-highline-border">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-lg">{remediation.service_name}</div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${config.bg} ${config.color}`}>
            <span>{config.icon}</span>
            <span className="text-sm font-medium">{config.label}</span>
          </div>
        </div>
        <div className="text-xs text-highline-muted font-mono">ID: {remediation.id}</div>
      </div>

      {/* Info Grid */}
      <div className="p-4 border-b border-highline-border grid grid-cols-2 gap-3">
        <InfoItem label="Repository" value={remediation.github_repo.replace('https://github.com/', '')} />
        <InfoItem label="Container" value={remediation.container_name || 'N/A'} />
        <InfoItem label="Started" value={new Date(remediation.start_time).toLocaleString()} />
        <InfoItem label="Duration" value={remediation.duration || 'Running...'} />
        {remediation.exit_code !== undefined && (
          <InfoItem label="Exit Code" value={String(remediation.exit_code)} />
        )}
      </div>

      {/* Error Log */}
      <div className="p-4 border-b border-highline-border">
        <div className="text-xs text-highline-muted uppercase tracking-wider mb-2">Error Triggering Remediation</div>
        <div className="bg-highline-bg rounded-lg p-3 text-xs font-mono text-highline-error/80 max-h-32 overflow-y-auto">
          {remediation.error_log}
        </div>
      </div>

      {/* Agent Report */}
      {remediation.agent_report && (
        <div className="p-4">
          <div className="text-xs text-highline-muted uppercase tracking-wider mb-2">Agent Report</div>
          <div className={`rounded-lg p-4 ${remediation.agent_report.success ? 'bg-highline-accent/5 border border-highline-accent/20' : 'bg-highline-error/5 border border-highline-error/20'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{remediation.agent_report.success ? '✅' : '❌'}</span>
              <span className={`font-medium ${remediation.agent_report.success ? 'text-highline-accent' : 'text-highline-error'}`}>
                {remediation.agent_report.summary}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              {remediation.agent_report.commit_hash && (
                <div className="flex items-center gap-2">
                  <span className="text-highline-muted">Commit:</span>
                  <span className="font-mono text-xs bg-highline-border px-2 py-0.5 rounded">
                    {remediation.agent_report.commit_hash.slice(0, 8)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-highline-muted">Pushed:</span>
                <span className={remediation.agent_report.pushed ? 'text-highline-accent' : 'text-highline-muted'}>
                  {remediation.agent_report.pushed ? 'Yes ✓' : 'No'}
                </span>
              </div>

              {remediation.agent_report.files_changed && remediation.agent_report.files_changed.length > 0 && (
                <div>
                  <span className="text-highline-muted">Files Changed:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {remediation.agent_report.files_changed.filter(f => f).map((file, i) => (
                      <span key={i} className="text-xs bg-highline-border px-2 py-0.5 rounded font-mono">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {remediation.agent_report.logs && (
                <div className="mt-2">
                  <span className="text-highline-muted">Logs:</span>
                  <div className="mt-1 bg-highline-bg rounded p-2 text-xs font-mono max-h-24 overflow-y-auto">
                    {remediation.agent_report.logs}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {remediation.error_message && (
        <div className="p-4 bg-highline-error/5">
          <div className="text-xs text-highline-error uppercase tracking-wider mb-1">Error</div>
          <div className="text-sm text-highline-error">{remediation.error_message}</div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-highline-bg rounded-lg p-2">
      <div className="text-[10px] text-highline-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm truncate" title={value}>{value}</div>
    </div>
  );
}
