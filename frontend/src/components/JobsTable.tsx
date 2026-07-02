import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Activity, RefreshCw, ChevronRight } from 'lucide-react';

interface JobHistoryItem {
  _id: string;
  ruleName: string;
  status: string;
  actionType: string;
  isReplay: boolean;
  attempts: Array<{ attemptNumber: number; status: string }>;
  createdAt: string;
  completedAt?: string;
}

interface Props {
  tenantId: string;
  onSelectJob: (jobId: string) => void;
}

export default function JobsTable({ tenantId, onSelectJob }: Props) {
  const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = () => {
      api.getJobs(statusFilter || undefined)
        .then((res) => {
          setJobs(res.data || []);
          setTotal(res.total || 0);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, [tenantId, statusFilter]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading jobs...</div>;
  }

  return (
    <div>
      {/* Filter bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        {['', 'pending', 'processing', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Job History</span>
          <span className="table-count">{total} total</span>
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={48} strokeWidth={1} /></div>
            <p>No jobs yet. Send a webhook to trigger automation rules!</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Rule</th>
                <th>Action</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job._id}>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>
                    <strong>{job.ruleName}</strong>
                    {job.isReplay && <span className="replay-badge"><RefreshCw size={10} /> Replay</span>}
                  </td>
                  <td>
                    <span className={`action-tag ${job.actionType}`}>
                      {job.actionType}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${job.status}`}>{job.status}</span>
                  </td>
                  <td>{job.attempts?.length || 0}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => onSelectJob(job._id)}
                    >
                      View Details <ChevronRight size={14} style={{ marginLeft: 4 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
