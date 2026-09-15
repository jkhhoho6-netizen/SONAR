// SONAR - UI 유틸리티
export const GRADE_LABEL = { CRITICAL:'심각', HIGH:'높음', MEDIUM:'보통', LOW:'낮음', NONE:'없음' };
export const GRADE_COLOR = { CRITICAL:'#ff3b52', HIGH:'#ff8a3d', MEDIUM:'#f4c04f', LOW:'#d8e4f0', NONE:'#8ba0b6' };
export const EVENT_TYPE_LABEL = { GEOPOLITICAL:'지정학', WEATHER:'기상', PORT_CONGESTION:'항만체선',
  LABOR_STRIKE:'노사분규', SANCTION:'제재', ACCIDENT:'사고', EPIDEMIC:'보건', REGULATION:'규제', PIRACY:'해적/보안' };
export const EVENT_TYPE_ICON = { GEOPOLITICAL:'⚔', WEATHER:'🌀', PORT_CONGESTION:'⚓', LABOR_STRIKE:'✊',
  SANCTION:'🚫', ACCIDENT:'⚠', EPIDEMIC:'🧪', REGULATION:'📋', PIRACY:'🏴' };
export const MATCH_REASON_LABEL = { CHOKEPOINT_TRANSIT:'요충지 통과', PORT_CALL:'중간 기항', ORIGIN:'출발항', DESTINATION:'도착항' };
export const SHIPMENT_STATUS = { DRAFT:['작성중','chip'], PENDING_APPROVAL:['승인 대기','chip warn'], ACTIVE:['등록 완료','chip ok'],
  IN_TRANSIT:['운송 중','chip info'], ARRIVED:['도착 완료','chip'], REJECTED:['반려','chip err'], CANCELLED:['취소','chip'] };
export const MATCH_STATUS = { OPEN:['미조치','chip warn'], ACKNOWLEDGED:['확인','chip info'], ACTION_TAKEN:['조치 완료','chip ok'],
  RESOLVED:['종결','chip'], FALSE_POSITIVE:['오탐','chip err'] };
export const USER_STATUS = { PENDING:['승인 대기','chip warn'], ACTIVE:['활성','chip ok'], REJECTED:['반려','chip err'], SUSPENDED:['정지','chip err'] };
export const EVENT_STATUS = { DRAFT:['검토 대기','chip warn'], PUBLISHED:['발행됨','chip ok'], DISMISSED:['기각','chip err'], EXPIRED:['만료','chip'] };
export const NOTI_STATUS = { DRAFT:['임시','chip'], PENDING_APPROVAL:['승인 대기','chip warn'], APPROVED:['승인','chip ok'],
  SENT:['발송 완료','chip ok'], FAILED:['발송 실패','chip err'], REJECTED:['반려','chip err'] };
export const CHANNEL_LABEL = { ALIMTALK:'알림톡', EMAIL:'이메일', IN_APP:'인앱' };
export const ACTION_TYPE = { REROUTE:'항로 변경', EXPEDITE:'긴급 처리', NOTIFY_CUSTOMER:'고객 통보',
  INSURANCE_CLAIM:'보험 처리', HOLD:'선적 보류', MONITOR:'모니터링', OTHER:'기타' };
export const ACTION_RESULT = { PENDING:['대기','chip'], IN_PROGRESS:['진행 중','chip warn'], DONE:['완료','chip ok'], FAILED:['실패','chip err'] };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const money = n => n == null ? '-' : '$' + Number(n).toLocaleString('en-US');
export const num = n => n == null ? '-' : Number(n).toLocaleString('ko-KR');
export const date = d => !d ? '-' : String(d).slice(0, 10).replace(/-/g, '.');
export const dt = d => !d ? '-' : new Date(d).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
export const pct = v => v == null ? '-' : Math.round(v * 100) + '%';
export const grade = g => `<span class="badge g-${g}"><i></i>${GRADE_LABEL[g] || g}</span>`;
export const chip = (map, k) => { const v = (map || {})[k]; return v ? `<span class="${v[1]}">${v[0]}</span>` : `<span class="chip">${esc(k)}</span>`; };
export const daysLeft = d => { if (!d) return null; return Math.ceil((new Date(d + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z')) / 86400000); };

/** 0~100 점수를 흰색 → 주황 → 빨강 으로 매핑 */
export function riskColor(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const stops = [[0,[255,255,255]],[25,[255,233,168]],[50,[244,192,79]],[75,[255,138,61]],[100,[255,59,82]]];
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [p0, c0] = stops[i-1], [p1, c1] = stops[i];
      const t = (s - p0) / (p1 - p0 || 1);
      return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(255,59,82)';
}

export function toast(msg, { type = 'info', title = '' } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${title ? `<div class="tt">${esc(title)}</div>` : ''}<div class="tb">${esc(msg)}</div>`;
  host.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .25s, transform .25s'; el.style.opacity = '0'; el.style.transform = 'translateX(18px)';
    setTimeout(() => el.remove(), 260); }, 3600);
}

export function modal({ title, body, actions = [], width }) {
  const host = document.getElementById('modal-host');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" ${width ? `style="max-width:${width}px"` : ''}>
    <div class="hd"><h3>${esc(title)}</h3><button class="x" data-close>&times;</button></div>
    <div class="bd">${body}</div>
    <div class="ft">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>
  </div>`;
  host.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector('[data-close]').onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
  actions.forEach((a, i) => { bg.querySelector(`[data-act="${i}"]`).onclick = () => a.onClick ? a.onClick(bg, close) : close(); });
  return { el: bg, close };
}

export function fieldError(form, details, fallback) {
  form.querySelectorAll('.field.bad').forEach(f => f.classList.remove('bad'));
  let hit = false;
  (details || []).forEach(d => {
    const f = form.querySelector(`[data-field="${d.field}"]`);
    if (f) { f.classList.add('bad'); const e = f.querySelector('.err'); if (e && fallback) e.textContent = fallback; hit = true; }
  });
  return hit;
}

export const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (vals[i] ?? ''), '');
