import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, PlayCircle, Loader2, FileJson } from 'lucide-react';

interface Attempt {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failure';
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
}

interface Job {
  _id: string;
  ruleName: string;
  actionType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  createdAt: string;
  completedAt?: string;
  isReplay: boolean;
  originalJobId?: string;
  eventPayload: any;
  attempts: Attempt[];
}

interface Props {
  tenantId: string;
  jobId: string;
  onBack: () => void;
}

export default function JobDetail({ tenantId, jobId, onBack }: Props) {
  const [job, setJob] = useState<Job | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayMessage, setReplayMessage] = useState('');

  useEffect(() => {
    const fetchJob = () => {
      api.getJobDetail(jobId).then((res) => setJob(res.data)).catch(console.error);
    };

    fetchJob();
    const interval = setInterval(fetchJob, 3000);
    return () => clearInterval(interval);
  }, [tenantId, jobId]);

  const handleReplay = async () => {
    setReplaying(true);
    setReplayMessage('');
    try {
      const res = await api.replayJob(jobId);
      setReplayMessage(`Replay created! New job ID: ${res.data._id}`);
    } catch (err: any) {
      setReplayMessage(`Replay failed: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  if (!job) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading job details...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Jobs
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-title">
            Job Details
            {job.isReplay && (
              <span className="replay-badge">
                <RefreshCw size={12} /> Replay of {job.originalJobId?.substring(0, 8)}...
              </span>
            )}
          </div>
          <div>
            <span className={`badge ${job.status}`}>{job.status}</span>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div className="detail-grid">
            <div className="detail-label">Job ID</div>
            <div className="detail-value">{job._id}</div>

            <div className="detail-label">Rule Executed</div>
            <div className="detail-value" style={{ fontWeight: 600 }}>{job.ruleName}</div>

            <div className="detail-label">Action Type</div>
            <div className="detail-value">
              <span className={`action-tag ${job.actionType}`}>{job.actionType}</span>
            </div>

            <div className="detail-label">Created At</div>
            <div className="detail-value">{new Date(job.createdAt).toLocaleString()}</div>

            {job.completedAt && (
              <>
                <div className="detail-label">Completed At</div>
                <div className="detail-value">{new Date(job.completedAt).toLocaleString()}</div>
              </>
            )}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleReplay}
              disabled={replaying || job.status === 'processing' || job.status === 'retrying'}
            >
              {replaying ? <Loader2 size={16} className="spinner" style={{ margin: 0 }} /> : <PlayCircle size={16} />}
              {replaying ? 'Replaying...' : 'Replay This Job'}
            </button>
            {replayMessage && (
              <span style={{ 
                fontSize: '13px', 
                padding: '6px 12px', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: replayMessage.startsWith('Replay created') ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                color: replayMessage.startsWith('Replay created') ? 'var(--color-success)' : 'var(--color-error)',
                border: `1px solid ${replayMessage.startsWith('Replay created') ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
              }}>
                {replayMessage.startsWith('Replay created') ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {replayMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-panel">
        <h3><AlertCircle size={20} className="logo-icon" style={{ color: 'var(--color-text)' }} /> Execution Attempts</h3>
        {job.attempts.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No execution attempts yet.</p>
        ) : (
          <div className="attempts-list">
            {job.attempts.map((attempt, index) => (
              <div key={index} className="attempt-item">
                <div className="attempt-header">
                  <div className="attempt-number">
                    Attempt #{attempt.attemptNumber}
                  </div>
                  <div>
                    <span className={`badge ${attempt.status === 'success' ? 'completed' : 'failed'}`}>
                      {attempt.status}
                    </span>
                  </div>
                </div>
                
                <div className="detail-grid" style={{ marginTop: '12px' }}>
                  <div className="detail-label">Started</div>
                  <div className="detail-value">{new Date(attempt.startedAt).toLocaleString()}</div>
                  
                  {attempt.completedAt && (
                    <>
                      <div className="detail-label">Completed</div>
                      <div className="detail-value">{new Date(attempt.completedAt).toLocaleString()}</div>
                    </>
                  )}
                </div>

                {attempt.error && (
                  <div className="error-box">
                    <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--color-error)' }}>Error: {attempt.error.message}</div>
                    {attempt.error.stack && (
                      <div style={{ opacity: 0.8 }}>{attempt.error.stack}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-panel">
        <h3><FileJson size={20} className="logo-icon" style={{ color: 'var(--color-text)' }} /> Event Payload (Snapshot)</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          This is the exact payload that triggered this job. Replaying the job will use this identical payload.
        </p>
        <div className="code-block">
          {JSON.stringify(job.eventPayload, null, 2)}
        </div>
      </div>
    </div>
  );
}
