// Single place that talks to the backend. No DB credentials ever live in the frontend.
const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const BASE = rawBase.replace(/\/+$/, '');

export const getToken = () => sessionStorage.getItem('access_token');

async function request(method, path, body) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['X-Auth-Token'] = token;
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  // Accept either a bare payload or { data: ... }
  return data && data.data !== undefined ? data.data : data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  put: (p, b) => request('PUT', p, b || {}),
  del: (p) => request('DELETE', p),
  verify: (reference, method = 'MANUAL') =>
    request('POST', '/verify', {
      reference: String(reference).trim(),
      method: method === 'QR' ? 'QR' : 'MANUAL',
    }),
};
