// SONAR - HTTP 서버 (REST API + 정적 파일). 외부 의존성 없음.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { initDb } from './db.js';
import { routes, ApiError } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 4173);

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon',
  '.woff2':'font/woff2', '.map':'application/json' };

function send(res, status, payload, headers = {}) {
  const body = payload === undefined || payload === null ? '' : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function sendError(res, status, code, message, details) {
  send(res, status, { error: { code, message, details: details || undefined, timestamp: new Date().toISOString() } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2e6) { reject(new ApiError(400, 'PAYLOAD_TOO_LARGE', '요청 본문이 너무 큽니다.')); req.destroy(); } });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new ApiError(400, 'MALFORMED_JSON', '요청 본문이 올바른 JSON 형식이 아닙니다.')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel !== '/index.html') return serveStatic(req, res, '/index.html');
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('public/index.html 이 없습니다.');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const candidates = routes.filter(r => r.regex.test(pathname));
  if (!candidates.length)
    return sendError(res, 404, 'NOT_FOUND', `요청한 API 경로를 찾을 수 없습니다: ${pathname}`);
  const route = candidates.find(r => r.method === req.method);
  if (!route)
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', `${req.method} 는 이 경로에서 지원되지 않습니다.`,
      [{ allow: candidates.map(c => c.method) }]);

  try {
    const m = pathname.match(route.regex);
    const params = {};
    route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const query = Object.fromEntries(url.searchParams.entries());
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    let user = null;
    if (token && db.sessions.has(token)) user = db.users.find(u => u.userId === db.sessions.get(token).userId) || null;

    if (route.auth && !user) throw new ApiError(401, 'UNAUTHORIZED', '인증 토큰이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    if (route.roles && (!user || !route.roles.includes(user.role)))
      throw new ApiError(403, 'FORBIDDEN', '시스템 관리자 권한이 필요한 기능입니다.');

    const out = await route.handler({ req, res, params, query, body, user, token });
    if (out && typeof out === 'object' && 'status' in out && (out.body !== undefined || out.status === 204)) {
      if (out.status === 204) { res.writeHead(204); return res.end(); }
      return send(res, out.status, out.body);
    }
    return send(res, 200, out);
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message, err.details);
    console.error('[SONAR] unhandled', err);
    return sendError(res, 500, 'INTERNAL_ERROR', '서버 내부 오류가 발생했습니다.');
  }
});

initDb();
server.listen(PORT, () => {
  console.log(`\n  SONAR prototype server`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API  ${routes.length} endpoints  |  matches ${db.impactMatches.length}`);
  console.log(`  운영담당자  operator@sonar.io / sonar1234`);
  console.log(`  관리자      admin@sonar.io    / sonar1234\n`);
});
