import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Rule {
  _id: string;
  name: string;
  isActive: boolean;
  triggerSource: string;
  triggerEventType: string;
  conditions: Array<{ field: string; operator: string; value?: any }>;
  actions: Array<{ type: string; config: Record<string, any> }>;
}

interface Props {
  tenantId: string;
}

export default function RulesList({ tenantId }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRules()
      .then((res) => setRules(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading rules...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Automation Rules</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          Rules that evaluate incoming webhook events and trigger actions
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No automation rules configured for this tenant.</p>
        </div>
      ) : (
        rules.map((rule) => (
          <div key={rule._id} className="rule-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="rule-name">{rule.name}</div>
              <span className={`badge ${rule.isActive ? 'completed' : 'failed'}`}>
                {rule.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="rule-trigger">
              📡 Source: <strong>{rule.triggerSource}</strong> &nbsp;|&nbsp;
              📌 Event: <strong>{rule.triggerEventType}</strong>
            </div>

            {rule.conditions.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <strong>Conditions:</strong>
                {rule.conditions.map((c, i) => (
                  <span key={i} style={{
                    display: 'inline-block',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    background: 'var(--color-bg)',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}>
                    {c.field} {c.operator} {c.value !== undefined ? JSON.stringify(c.value) : ''}
                  </span>
                ))}
              </div>
            )}

            <div className="rule-actions-list">
              {rule.actions.map((action, i) => (
                <span key={i} className={`action-tag ${action.type}`}>
                  {action.type}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
