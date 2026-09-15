// SONAR - 라우터 및 애플리케이션 셸
import { api, auth, ApiError } from './api.js';
import { esc, toast, num } from './ui.js';
import * as Auth from './views/auth.js';
import * as Op from './views/operator.js';
import * as Ad from './views/admin.js';

const ROUTES = [
  { re:/^\/login$/,                view:Auth.login,        guest:true, bare:true },
  { re:/^\/signup$/,               view:Auth.signup,       guest:true, bare:true },
  { re:/^\/radar$/,                view:Op.radar,          flush:true },
  { re:/^\/matches$/,              view:Op.matchList },
  { re:/^\/matches\/([^/]+)$/,     view:Op.matchDetail },
  { re:/^\/events$/,               view:Op.eventList },
  { re:/^\/events\/([^/]+)$/,      view:Op.eventDetail },
  { re:/^\/shipments$/,            view:Op.shipmentList },
  { re:/^\/shipments\/new$/,       view:Op.shipmentNew },
  { re:/^\/shipments\/([^/]+)$/,   view:Op.shipmentDetail },
  { re:/^\/notifications$/,        view:Op.notifications },
  { re:/^\/admin$/,                view:Ad.overview,       roles:['ADMIN'] },
  { re:/^\/admin\/events$/,        view:Ad.eventMonitor,   roles:['ADMIN'] },
  { re:/^\/admin\/events\/([^/]+)$/,view:Ad.eventReview,   roles:['ADMIN'] },
  { re:/^\/admin\/feeds$/,         view:Ad.feedList,       roles:['ADMIN'] },
  { re:/^\/admin\/sources$/,       view:Ad.sources,        roles:['ADMIN'] },
  { re:/^\/admin\/thresholds$/,    view:Ad.thresholds,     roles:['ADMIN'] },
  { re:/^\/admin\/users$/,         view:Ad.users,          roles:['ADMIN'] },
  { re:/^\/admin\/shipments$/,     view:Ad.shipmentApproval,roles:['ADMIN'] },
  { re:/^\/admin\/notifications$/, view:Ad.notificationApproval, roles:['ADMIN'] },
  { re:/^\/admin\/feedback$/,      view:Ad.feedback,       roles:['ADMIN'] },
  { re:/^\/admin\/audit$/,         view:Ad.audit,          roles:['ADMIN'] }
];

export const badges = { openMatches:0, unreadNoti:0, pendingUsers:0, pendingShipments:0, draftEvents:0, pendingNoti:0 };

const NAV_OPERATOR = [
  { g:'모니터링' },
  { h:'#/radar',        ic:'◎', t:'리스크 레이더' },
  { h:'#/matches',      ic:'▤', t:'영향 건 목록', b:'openMatches', alert:true },
  { h:'#/events',       ic:'⚡', t:'리스크 이벤트' },
  { g:'화물 관리' },
  { h:'#/shipments',    ic:'▣', t:'내 화물' },
  { h:'#/shipments/new',ic:'＋', t:'화물 등록' },
  { g:'알림' },
  { h:'#/notifications',ic:'✉', t:'알림 센터', b:'unreadNoti', alert:true }
];
const NAV_ADMIN = [
  { g:'운영 현황' },
  { h:'#/admin',              ic:'▦', t:'운영 대시보드' },
  { h:'#/radar',              ic:'◎', t:'전체 리스크 레이더' },
  { g:'리스크 파이프라인' },
  { h:'#/admin/events',       ic:'⚡', t:'이벤트 모니터링', b:'draftEvents', alert:true },
  { h:'#/admin/feeds',        ic:'▤', t:'수집 원문' },
  { h:'#/admin/sources',      ic:'⌘', t:'수집 소스 관리' },
  { h:'#/admin/thresholds',   ic:'⚙', t:'임계값·기준 설정' },
  { g:'승인 / 관리' },
  { h:'#/admin/users',        ic:'👤', t:'회원 관리', b:'pendingUsers', alert:true },
  { h:'#/admin/shipments',    ic:'▣', t:'화물 등록 승인', b:'pendingShipments', alert:true },
  { h:'#/admin/notifications',ic:'✉', t:'알림 발송 승인', b:'pendingNoti', alert:true },
  { h:'#/admin/feedback',     ic:'◐', t:'매칭 피드백' },
  { h:'#/admin/audit',        ic:'≣', t:'감사 로그' }
];

function shellHtml(user, path) {
  const items = user.role === 'ADMIN' ? NAV_ADMIN : NAV_OPERATOR;
  const exact = items.some(n => n.h && n.h.slice(1) === path);
  const nav = items.map(n => {
    if (n.g) return `<div class="group">${n.g}</div>`;
    const self = n.h.slice(1);
    const on = path === self || (!exact && path.startsWith(self + '/'));
    const c = n.b ? badges[n.b] : 0;
    return `<a href="${n.h}" class="${on ? 'on' : ''}"><span class="ic">${n.ic}</span>${n.t}${c ? `<span class="cnt ${n.alert ? 'alert' : ''}">${c}</span>` : ''}</a>`;
  }).join('');
  return `<div class="shell">
    <aside class="side">
      <div class="brand">
        <div class="logo"><i></i>SONAR</div>
        <div class="sub">MARITIME RISK RADAR</div>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="me">
        <div class="av">${esc(user.name.slice(0, 1))}</div>
        <div><div class="nm">${esc(user.name)} <span class="muted" style="font-weight:400">${user.role === 'ADMIN' ? '관리자' : '담당자'}</span></div>
        <div class="co">${esc(user.companyName || '')}</div></div>
        <button id="logout">로그아웃</button>
      </div>
    </aside>
    <div class="main">
      <header class="top"><h1 id="pg-title"></h1><span class="crumb" id="pg-crumb"></span><div class="spacer"></div>
        <span class="clock" id="clock"></span></header>
      <div class="body" id="page"><div class="loading"><span class="spin"></span></div></div>
    </div>
  </div>`;
}

async function refreshBadges() {
  const u = auth.user; if (!u) return;
  try {
    if (u.role === 'ADMIN') {
      const o = await api.get('/admin/overview');
      badges.pendingUsers = o.users.pending; badges.pendingShipments = o.shipments.pendingApproval;
      badges.draftEvents = o.pipeline.draftEventCount; badges.pendingNoti = o.notifications.pendingApproval;
    } else {
      const s = await api.get('/dashboard/summary');
      badges.openMatches = s.openMatchCount; badges.unreadNoti = s.unreadNotificationCount;
    }
  } catch { /* 배지는 실패해도 화면을 막지 않는다 */ }
}

let currentPath = '';
async function render() {
  const root = document.getElementById('root');
  const path = (location.hash.replace(/^#/, '') || '/radar');
  const user = auth.user;
  const route = ROUTES.find(r => r.re.test(path));

  if (!route) { location.hash = user ? (user.role === 'ADMIN' ? '#/admin' : '#/radar') : '#/login'; return; }
  if (!user && !route.guest) { location.hash = '#/login'; return; }
  if (user && route.guest) { location.hash = user.role === 'ADMIN' ? '#/admin' : '#/radar'; return; }
  if (route.roles && user && !route.roles.includes(user.role)) {
    root.innerHTML = shellHtml(user, path);
    bindShell();
    document.getElementById('page').innerHTML = `<div class="banner err"><span class="ic">⛔</span><div>
      <b>접근 권한이 없습니다 (403)</b><br>이 화면은 시스템 관리자 전용입니다. 현재 계정은 화물 운영 담당자 권한입니다.</div></div>
      <a class="btn" href="#/radar">리스크 레이더로 이동</a>`;
    return;
  }

  const params = (path.match(route.re) || []).slice(1).map(decodeURIComponent);

  if (route.bare) {
    root.innerHTML = '';
    const out = await route.view({ params, root });
    root.innerHTML = out.html;
    out.mount && out.mount(root);
    return;
  }

  await refreshBadges();
  root.innerHTML = shellHtml(user, path);
  bindShell();
  const page = document.getElementById('page');
  page.innerHTML = `<div class="loading"><span class="spin"></span> 불러오는 중…</div>`;
  try {
    const out = await route.view({ params, user, page });
    document.getElementById('pg-title').textContent = out.title || '';
    document.getElementById('pg-crumb').textContent = out.crumb || '';
    page.classList.toggle('flush', !!route.flush);
    page.innerHTML = out.html;
    out.mount && await out.mount(page);
  } catch (err) {
    const msg = err instanceof ApiError ? `${err.message}` : (err.message || '알 수 없는 오류');
    page.innerHTML = `<div class="banner err"><span class="ic">⚠</span><div><b>화면을 불러오지 못했습니다.</b><br>
      ${esc(msg)} <span class="mono muted">(${esc(err.code || 'ERROR')})</span></div></div>
      <button class="btn" onclick="location.reload()">다시 시도</button>`;
    console.error(err);
  }
  currentPath = path;
}

function bindShell() {
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { try { await api.post('/auth/logout'); } catch {} auth.clear(); location.hash = '#/login'; };
  const clock = document.getElementById('clock');
  const tick = () => { if (!document.body.contains(clock)) return;
    clock.textContent = new Date().toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) + ' KST'; };
  tick(); setInterval(tick, 20000);
}

export function go(hash) { location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
if (document.readyState !== 'loading') render();
