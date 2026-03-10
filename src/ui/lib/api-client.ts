function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return ''; // Uses Next.js rewrites
}

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Metagraphs
  getMetagraphs: () => fetchApi('/api/metagraphs'),

  // Status
  getStatus: (metagraph: string) =>
    fetchApi(`/api/metagraphs/${metagraph}/status`),

  // Nodes
  getNodes: (metagraph: string) =>
    fetchApi(`/api/metagraphs/${metagraph}/nodes`),
  getNode: (metagraph: string, id: number) =>
    fetchApi(`/api/metagraphs/${metagraph}/nodes/${id}`),

  // Logs
  getLogs: (metagraph: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchApi(`/api/metagraphs/${metagraph}/logs${query}`);
  },
  getLogStreamUrl: (metagraph: string) => {
    const token = getToken();
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3001/api/metagraphs/${metagraph}/logs/stream?token=${token}`;
  },

  // Operations
  runCheck: (metagraph: string) =>
    fetchApi(`/api/metagraphs/${metagraph}/ops/run-check`, { method: 'POST' }),
  restart: (metagraph: string, reason?: string) =>
    fetchApi(`/api/metagraphs/${metagraph}/ops/restart`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  restartNode: (metagraph: string, nodeIndex: number, layers: string[]) =>
    fetchApi(`/api/metagraphs/${metagraph}/ops/restart-node`, {
      method: 'POST',
      body: JSON.stringify({ nodeIndex, layers }),
    }),
  toggleMonitoring: (metagraph: string, enabled: boolean) =>
    fetchApi(`/api/metagraphs/${metagraph}/ops/monitoring/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  // Config
  getConfig: (metagraph: string) =>
    fetchApi(`/api/metagraphs/${metagraph}/config`),

  // Health
  getHealth: () => fetchApi('/api/health'),
};
