import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Attempt {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  status: string;
  result?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    httpStatus?: number;
    stack?: string;
  };
}

interface JobDetailData {
  _id: string;
  tenantId: string;
  webhookEventId: string;
  ruleId: string;
  ruleName: string;
  status: string;
  actionType: string;
  actionConfig: Record<string, any>;
  eventPayload: Record<string, any>;
  attempts: Attempt[];
  isReplay: boolean;
  originalJobId?: string;
  createdAt: string;
  completedAt?: string;
}

interface Props {
  tenantId: string;
  jobId: string;
  onBack: () => void;
}

export default function JobDetail({ tenantId, jobId, onBack }: Props) {
  const [job, setJob] = useState<JobDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [replayMessage, setReplayMessage] = useState('');

  useEffect(() => {
    const fetchJob = () => {
      api.getJobDetail(jobId)
        .then((res) => setJob(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchJob();
    const interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [tenantId, jobId]);

  const handleReplay = async () => {
    setReplaying(true);
    setReplayMessage('');
    try {
      const res = await api.replayJob(jobId);
      setReplayMessage(`✅ Replay created! New job ID: ${res.data._id}`);
    } catch (err: any) {
      setReplayMessage(`❌ Replay failed: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  if (loading || !job) {
    return <div className="loading"><div className="spinner"></div>Loading job details...</div>;
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '16px' }}>
        ← Back to Jobs
      </button>

      <div className="detail-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>
            Job Details
            {job.isReplay && <span className="replay-badge">🔄 Replay of {job.originalJobId?.substring(0, 8)}...</span>}
          </h3>
          {job.status === 'failed' && (
            <button
              className="btn btn-primary"
              onClick={handleReplay}
              disabled={replaying}
            >
              {replaying ? '⏳ Replaying...' : '🔄 Replay This Job'}
            </button>
          )}
        </div>

        {replayMessage && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            background: replayMessage.startsWith('✅') ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
            color: replayMessage.startsWith('✅') ? 'var(--color-success)' : 'var(--color-error)',
            fontSize: '13px',
          }}>
            {replayMessage}
          </div>
        )}

        <div className="detail-grid">
          <span className="detail-label">Job ID</span>
          <span className="detail-value" style={{ fontFamily: 'monospace' }}>{job._id}</span>

          <span className="detail-label">Status</span>
          <span className="detail-value">
            <span className={`badge ${job.status}`}>{job.status}</span>
          </span>

          <span className="detail-label">Rule</span>
          <span className="detail-value">{job.ruleName}</span>

          <span className="detail-label">Action Type</span>
          <span className="detail-value">
            <span className={`action-tag ${job.actionType}`}>{job.actionType}</span>
          </span>

          <span className="detail-label">Created</span>
          <span className="detail-value">{new Date(job.createdAt).toLocaleString()}</span>

          {job.completedAt && (
            <>
              <span className="detail-label">Completed</span>
              <span className="detail-value">{new Date(job.completedAt).toLocaleString()}</span>
            </>
          )}

          <span className="detail-label">Event ID</span>
          <span className="detail-value" style={{ fontFamily: 'monospace' }}>{job.webhookEventId}</span>
        </div>

        {/* Action Config */}
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            Action Configuration
          </h4>
          <div className="code-block">
            {JSON.stringify(job.actionConfig, null, 2)}
          </div>
        </div>

        {/* Event Payload */}
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            Event Payload
          </h4>
          <div className="code-block">
            {JSON.stringify(job.eventPayload, null, 2)}
          </div>
        </div>

        {/* Attempts */}
        <div className="attempts-list" style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
            Execution Attempts ({job.attempts?.length || 0})
          </h4>

          {(!job.attempts || job.attempts.length === 0) ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No attempts recorded yet</p>
            </div>
          ) : (
            job.attempts.map((attempt, idx) => (
              <div key={idx} className="attempt-item">
                <div className="attempt-header">
                  <span className="attempt-number">Attempt #{attempt.attemptNumber}</span>
                  <span className={`badge ${attempt.status === 'success' ? 'completed' : 'failed'}`}>
                    {attempt.status}
                  </span>
                </div>
                <div className="detail-grid" style={{ fontSize: '12px' }}>
                  <span className="detail-label">Started</span>
                  <span className="detail-value">{new Date(attempt.startedAt).toLocaleString()}</span>
                  {attempt.completedAt && (
                    <>
                      <span className="detail-label">Completed</span>
                      <span className="detail-value">{new Date(attempt.completedAt).toLocaleString()}</span>
                    </>
                  )}
                </div>
                {attempt.result && (
                  <div className="code-block" style={{ marginTop: '8px', fontSize: '11px' }}>
                    {JSON.stringify(attempt.result, null, 2)}
                  </div>
                )}
                {attempt.error && (
                  <div className="error-box">
                    {attempt.error.code && `[${attempt.error.code}] `}
                    {attempt.error.message}
                    {attempt.error.httpStatus && ` (HTTP ${attempt.error.httpStatus})`}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
