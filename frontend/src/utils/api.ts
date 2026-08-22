const BASE = '';

function getToken() { return localStorage.getItem('accessToken'); }

export async function api(path: string, opts: RequestInit = {}) {
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function useApi() { return { api }; }
