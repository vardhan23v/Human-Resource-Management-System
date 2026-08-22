const BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/+$/, '');

function getToken() { return localStorage.getItem('accessToken'); }

let refreshing: Promise<boolean> | null = null;
/** Single-flight refresh: concurrent 401s share one refresh request. */
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) return false;
    try {
      const res = await fetch(BASE + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data?.accessToken) return false;
      localStorage.setItem('accessToken', data.data.accessToken);
      if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    } catch { return false; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

export async function api(path: string, opts: RequestInit = {}, _retried = false): Promise<any> {
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...opts, headers, credentials: 'include' });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 401 && !_retried && token && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/refresh')) {
    if (await tryRefresh()) return api(path, opts, true);
    localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function useApi() { return { api }; }
