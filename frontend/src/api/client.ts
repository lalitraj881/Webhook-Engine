const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const tenantId = localStorage.getItem('tenantId') || '';

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Tenants
  getTenants: () => request('/tenants'),

  // Events
  getEvents: (page = 1, limit = 50) =>
    request(`/events?page=${page}&limit=${limit}`),

  // Jobs
  getJobs: (status?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return request(`/jobs?${params}`);
  },

  getJobStats: () => request('/jobs/stats'),

  getJobDetail: (jobId: string) => request(`/jobs/${jobId}`),

  replayJob: (jobId: string) =>
    request(`/jobs/${jobId}/replay`, { method: 'POST' }),

  // Rules
  getRules: () => request('/rules'),
};
