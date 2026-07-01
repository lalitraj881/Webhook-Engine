import { useState, useEffect } from 'react';
import { api } from '../api/client';

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
        <h3>🧪 Quick Test Commands</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
          Send a test webhook to see the pipeline in action:
        </p>
        <div className="code-block">
{`# Send a Shopify order webhook (triggers rules for this tenant)
curl -X POST http://localhost:3000/webhooks/${tenantId}/shopify \\
  -H "Content-Type: application/json" \\
  -d '{"eventType":"order.created","id":"evt_'$(date +%s)'","order":{"total_price":750,"currency":"USD","customer":"John Doe"}}'

# Send a duplicate (should be deduplicated)
curl -X POST http://localhost:3000/webhooks/${tenantId}/shopify \\
  -H "Content-Type: application/json" \\
  -d '{"eventType":"order.created","id":"evt_duplicate_test","order":{"total_price":100}}'

# Trigger a payment failure event
curl -X POST http://localhost:3000/webhooks/${tenantId}/stripe \\
  -H "Content-Type: application/json" \\
  -d '{"eventType":"payment.failed","id":"evt_pay_'$(date +%s)'","amount":250,"customer":"Jane Doe"}'`}
        </div>
      </div>
    </div>
  );
}
