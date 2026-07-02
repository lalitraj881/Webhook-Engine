import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Webhook } from 'lucide-react';

interface WebhookEvent {
  _id: string;
  source: string;
  eventType: string;
  status: string;
  idempotencyKey: string;
  receivedAt: string;
  processedAt?: string;
  payload: Record<string, any>;
}

interface Props {
  tenantId: string;
}

export default function EventsTable({ tenantId }: Props) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = () => {
      api.getEvents()
        .then((res) => {
          setEvents(res.data || []);
          setTotal(res.total || 0);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading events...</div>;
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <span className="table-title">Webhook Events</span>
        <span className="table-count">{total} total</span>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Webhook size={48} strokeWidth={1} /></div>
          <p>No webhook events received yet. Send a test webhook!</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Source</th>
              <th>Event Type</th>
              <th>Status</th>
              <th>Idempotency Key</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event._id}>
                <td>{new Date(event.receivedAt).toLocaleString()}</td>
                <td><strong>{event.source}</strong></td>
                <td>{event.eventType}</td>
                <td><span className={`badge ${event.status}`}>{event.status}</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {event.idempotencyKey?.substring(0, 30)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
