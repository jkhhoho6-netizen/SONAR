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

/**
 * 전송 계층.
 *  - 서버 배포: fetch 로 실제 REST API 호출
 *  - 서버 없는 정적 배포: 동일한 라우터를 브라우저에서 실행 (embedded-server.js)
 * window.SONAR_EMBEDDED 가 true 면 내장 런타임을 쓴다.
 */
export const isEmbedded = () => globalThis.SONAR_EMBEDDED === true;
let embedded = null;
async function embeddedHandler() {
  if (!embedded) embedded = await import('./embedded-server.js');
  return embedded;
}

async function request(method, path, { body, query } = {}) {
  const url = new URL(BASE + path, location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });

  let status, payload;
  if (isEmbedded()) {
    const { handle } = await embeddedHandler();
    const q = Object.fromEntries(url.searchParams.entries());
    ({ status, payload } = await handle(method, url.pathname, { query: q, body: body ?? {}, token: auth.token }));
  } else {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    status = res.status;
    if (status === 204) return null;
    const text = await res.text();
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  }

  if (status === 204) return null;
  if (status < 200 || status >= 300) {
    const err = new ApiError(status, payload);
    if (status === 401 && !path.startsWith('/auth/')) { auth.clear(); location.hash = '#/login'; }
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
