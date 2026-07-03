import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ListChecks, Webhook, Link, Mail, Terminal } from 'lucide-react';

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  value: any;
}

interface Action {
  type: 'webhook' | 'email' | 'log';
  config: Record<string, any>;
}

interface Rule {
  _id: string;
  name: string;
  isActive: boolean;
  triggerSource: string;
  triggerEventType: string;
  conditions: Condition[];
  actions: Action[];
}

interface Props {
  tenantId: string;
}

function ActionIcon({ type }: { type: string }) {
  if (type === 'webhook') return <Webhook size={12} />;
  if (type === 'email') return <Mail size={12} />;
  if (type === 'log') return <Terminal size={12} />;
  return null;
}

export default function RulesList({ tenantId }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getRules(tenantId)
      .then((res) => setRules(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading rules...</div>;
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title">Configured Rules</div>
        <div className="table-count">{rules.length} active</div>
      </div>

      <div style={{ padding: '24px' }}>
        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ListChecks size={48} strokeWidth={1} /></div>
            <p>No automation rules configured for this tenant.</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule._id} className="rule-card">
              <div className="rule-name">{rule.name}</div>

              <div className="rule-trigger">
                <div className="rule-trigger-item">
                  <Link size={14} style={{ opacity: 0.7 }} /> Source: <strong>{rule.triggerSource}</strong>
                </div>
                <div style={{ color: 'var(--color-border)' }}>|</div>
                <div className="rule-trigger-item">
                  <Webhook size={14} style={{ opacity: 0.7 }} /> Event: <strong>{rule.triggerEventType}</strong>
                </div>
              </div>

              {rule.conditions.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Conditions (AND)</div>
                  {rule.conditions.map((c, i) => (
                    <div key={i} style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--color-info)' }}>{c.field}</span>{' '}
                      <span style={{ color: 'var(--color-text-secondary)', margin: '0 8px' }}>{c.operator}</span>{' '}
                      <span style={{ color: 'var(--color-success)' }}>{JSON.stringify(c.value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {rule.conditions.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                  No conditions — fires on every matching event
                </div>
              )}

              <div className="rule-actions-list" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {rule.actions.map((action, i) => (
                  <span key={i} className={`action-tag ${action.type}`}>
                    <ActionIcon type={action.type} />
                    {action.type}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
