import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Terminal, Copy } from 'lucide-react';

interface Stats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface Props {
  tenantId: string;
}

export default function Dashboard({ tenantId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = () => {
      api.getJobStats()
        .then((res) => setStats(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000); // Auto-refresh every 2s
    return () => clearInterval(interval);
  }, [tenantId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading || !stats) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card processing">
          <div className="stat-label">Processing</div>
          <div className="stat-value">{stats.processing}</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card failed">
          <div className="stat-label">Failed</div>
          <div className="stat-value">{stats.failed}</div>
        </div>
      </div>

      <div className="detail-panel">
        <h3><Terminal size={20} className="logo-icon" /> Quick Test Commands</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Send a test webhook to see the pipeline in action. Note: Run these from the project root directory.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="code-block" style={{ position: 'relative' }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ position: 'absolute', right: '12px', top: '12px', padding: '4px' }}
              onClick={() => copyToClipboard(`.\\scripts\\send-webhook.ps1 -TenantId ${tenantId}`)}
              title="Copy command"
            >
              <Copy size={14} />
            </button>
            <div className="code-comment"># 1. Send a Shopify order webhook (triggers rules for this tenant)</div>
            <div style={{ color: '#a78bfa' }}># Windows (PowerShell)</div>
            <div>.\scripts\send-webhook.ps1 -TenantId {tenantId}</div>
            <div style={{ color: '#a78bfa', marginTop: '8px' }}># Mac / Linux</div>
            <div>./scripts/send-webhook.sh {tenantId}</div>
          </div>

          <div className="code-block" style={{ position: 'relative' }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ position: 'absolute', right: '12px', top: '12px', padding: '4px' }}
              onClick={() => copyToClipboard(`.\\scripts\\send-duplicate.ps1 -TenantId ${tenantId}`)}
              title="Copy command"
            >
              <Copy size={14} />
            </button>
            <div className="code-comment"># 2. Send a duplicate (should be deduplicated automatically)</div>
            <div style={{ color: '#a78bfa' }}># Windows (PowerShell)</div>
            <div>.\scripts\send-duplicate.ps1 -TenantId {tenantId}</div>
            <div style={{ color: '#a78bfa', marginTop: '8px' }}># Mac / Linux</div>
            <div>./scripts/send-duplicate.sh {tenantId}</div>
          </div>

          <div className="code-block" style={{ position: 'relative' }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ position: 'absolute', right: '12px', top: '12px', padding: '4px' }}
              onClick={() => copyToClipboard(`.\\scripts\\trigger-failure.ps1 -TenantId ${tenantId}`)}
              title="Copy command"
            >
              <Copy size={14} />
            </button>
            <div className="code-comment"># 3. Trigger a failing action to test retry backoff (use on Beta Store)</div>
            <div style={{ color: '#a78bfa' }}># Windows (PowerShell)</div>
            <div>.\scripts\trigger-failure.ps1 -TenantId {tenantId}</div>
            <div style={{ color: '#a78bfa', marginTop: '8px' }}># Mac / Linux</div>
            <div>./scripts/trigger-failure.sh {tenantId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
