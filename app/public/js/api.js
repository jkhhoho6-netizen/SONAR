// SONAR - API 클라이언트
const BASE = '/api/v1';
const TOKEN_KEY = 'sonar.token';
const USER_KEY = 'sonar.user';

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  set(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
};

export class ApiError extends Error {
  constructor(status, payload) {
    const e = (payload && payload.error) || {};
    super(e.message || `요청 처리 중 오류가 발생했습니다. (HTTP ${status})`);
    this.status = status; this.code = e.code || 'UNKNOWN'; this.details = e.details || [];
  }
}

async function request(method, path, { body, query } = {}) {
  const url = new URL(BASE + path, location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return null;
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!res.ok) {
    const err = new ApiError(res.status, payload);
    if (res.status === 401 && !path.startsWith('/auth/')) { auth.clear(); location.hash = '#/login'; }
    throw err;
  }
  return payload;
}

export const api = {
  get:   (p, query) => request('GET', p, { query }),
  post:  (p, body)  => request('POST', p, { body }),
  patch: (p, body)  => request('PATCH', p, { body }),
  put:   (p, body)  => request('PUT', p, { body }),
  del:   (p)        => request('DELETE', p)
};
