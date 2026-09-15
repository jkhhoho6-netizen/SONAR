// SONAR - 브라우저 내장 API 런타임.
// 서버 없이 배포(Artifact / 정적 호스팅)할 때 src/server.js 의 디스패치 로직을
// 그대로 브라우저에서 수행한다. 라우트·핸들러·데이터는 Node 판과 동일한 모듈을 쓴다.
import db, { initDb } from '../srv/db.js';
import { routes, ApiError } from '../srv/api.js';

let ready = false;
function boot() { if (!ready) { initDb(); ready = true; } }

/**
 * @returns {{status:number, payload:any}} 서버의 HTTP 응답과 동일한 형태
 */
export async function handle(method, pathname, { query = {}, body = {}, token = null } = {}) {
  boot();
  const err = (status, code, message, details) =>
    ({ status, payload: { error: { code, message, details: details || undefined, timestamp: new Date().toISOString() } } });

  const candidates = routes.filter(r => r.regex.test(pathname));
  if (!candidates.length) return err(404, 'NOT_FOUND', `요청한 API 경로를 찾을 수 없습니다: ${pathname}`);
  const route = candidates.find(r => r.method === method);
  if (!route) return err(405, 'METHOD_NOT_ALLOWED', `${method} 는 이 경로에서 지원되지 않습니다.`,
    [{ allow: candidates.map(c => c.method) }]);

  try {
    const m = pathname.match(route.regex);
    const params = {};
    route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

    let user = null;
    if (token && db.sessions.has(token)) user = db.users.find(u => u.userId === db.sessions.get(token).userId) || null;
    if (route.auth && !user) throw new ApiError(401, 'UNAUTHORIZED', '인증 토큰이 없거나 만료되었습니다. 다시 로그인해 주세요.');
    if (route.roles && (!user || !route.roles.includes(user.role)))
      throw new ApiError(403, 'FORBIDDEN', '시스템 관리자 권한이 필요한 기능입니다.');

    const out = await route.handler({ params, query, body, user, token });
    if (out && typeof out === 'object' && 'status' in out && (out.body !== undefined || out.status === 204))
      return { status: out.status, payload: out.status === 204 ? null : out.body };
    return { status: 200, payload: out };
  } catch (e) {
    if (e instanceof ApiError) return err(e.status, e.code, e.message, e.details);
    console.error('[SONAR embedded]', e);
    return err(500, 'INTERNAL_ERROR', '서버 내부 오류가 발생했습니다.');
  }
}

/** 데모 데이터를 최초 상태로 되돌린다 (임베디드 모드 전용) */
export function resetDemo() { ready = false; boot(); }
