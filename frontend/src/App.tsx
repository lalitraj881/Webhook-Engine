import { useState, useEffect, useCallback } from 'react';
import { api } from './api/client';
import Dashboard from './components/Dashboard';
import EventsTable from './components/EventsTable';
import JobsTable from './components/JobsTable';
import JobDetail from './components/JobDetail';
import RulesList from './components/RulesList';
import { Zap, LayoutDashboard, Radio, Settings, FileJson, Building2 } from 'lucide-react';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
}

type Tab = 'dashboard' | 'events' | 'jobs' | 'rules';

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load tenants on mount
  useEffect(() => {
    api.getTenants()
      .then((res) => {
        setTenants(res.data || []);
        if (res.data?.length > 0) {
          const savedTenant = localStorage.getItem('tenantId');
          const defaultId = savedTenant && res.data.find((t: Tenant) => t._id === savedTenant)
            ? savedTenant
            : res.data[0]._id;
          setSelectedTenantId(defaultId);
          localStorage.setItem('tenantId', defaultId);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleTenantChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTenantId(id);
    localStorage.setItem('tenantId', id);
    setSelectedJobId(null); // Reset selection on tenant change
  }, []);

  const selectedTenant = tenants.find(t => t._id === selectedTenantId);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div>
            <div className="header-logo">
              <Zap className="logo-icon" size={20} strokeWidth={2.5} />
              Webhook Engine
            </div>
            <div className="header-subtitle">Automation Dashboard</div>
          </div>
        </div>
        <div className="tenant-selector">
          <label htmlFor="tenant-select">Tenant:</label>
          <select
            id="tenant-select"
            value={selectedTenantId}
            onChange={handleTenantChange}
          >
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="nav-tabs-container">
        <nav className="nav-tabs">
          {(['dashboard', 'events', 'jobs', 'rules'] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setSelectedJobId(null); }}
            >
              {tab === 'dashboard' && <LayoutDashboard size={16} />}
              {tab === 'events' && <Radio size={16} />}
              {tab === 'jobs' && <Settings size={16} />}
              {tab === 'rules' && <FileJson size={16} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {!selectedTenantId ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Building2 size={48} strokeWidth={1} />
            </div>
            <p>No tenants found. Start the backend to seed demo data.</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard tenantId={selectedTenantId} />
            )}
            {activeTab === 'events' && (
              <EventsTable tenantId={selectedTenantId} />
            )}
            {activeTab === 'jobs' && !selectedJobId && (
              <JobsTable
                tenantId={selectedTenantId}
                onSelectJob={setSelectedJobId}
              />
            )}
            {activeTab === 'jobs' && selectedJobId && (
              <JobDetail
                tenantId={selectedTenantId}
                jobId={selectedJobId}
                onBack={() => setSelectedJobId(null)}
              />
            )}
            {activeTab === 'rules' && (
              <RulesList tenantId={selectedTenantId} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
