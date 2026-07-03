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
  );
}
