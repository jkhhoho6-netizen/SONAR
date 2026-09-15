// SONAR - 로그인 / 회원가입 화면
import { api, auth, ApiError, isEmbedded } from '../api.js';
import { esc, toast } from '../ui.js';

const HERO = `
<div class="auth-hero">
  <div class="rings">
    <span class="ring"></span><span class="ring" style="animation-delay:1.8s"></span><span class="ring" style="animation-delay:3.6s"></span>
  </div>
  <div style="position:relative">
    <div class="tag">MARITIME SUPPLY CHAIN RISK RADAR</div>
    <h1>SONAR</h1>
    <p class="claim">뉴스는 <b>바다가 위험하다</b>고 말하지만,<br><b>내 화물이 위험한지</b>는 말해주지 않습니다.<br>
      SONAR는 리스크 정보와 내 운송 건을 연결합니다.</p>
  </div>
  <div class="facts">
    <div class="fact"><b>2021</b><span>수에즈 좌초</span></div>
    <div class="fact"><b>2022</b><span>러·우 전쟁</span></div>
    <div class="fact"><b>2023</b><span>홍해 사태</span></div>
    <div class="fact"><b>2025</b><span>미중 관세</span></div>
    <div class="fact"><b>2026</b><span>호르무즈 사태</span></div>
  </div>
</div>`;

export async function login() {
  return {
    html: `<div class="auth-wrap">${HERO}
      <div class="auth-panel"><div class="auth-card">
        <h2>시스템 로그인</h2>
        <div class="sub">등록된 계정으로 로그인하세요. 신규 계정은 관리자 승인 후 사용할 수 있습니다.</div>
        <div id="err"></div>
        <form id="f" novalidate>
          <div class="field" data-field="email">
            <label>이메일 <span class="req">*</span></label>
            <input name="email" type="email" placeholder="name@company.com" autocomplete="username">
            <div class="err">이메일을 확인해 주세요.</div>
          </div>
          <div class="field" data-field="password">
            <label>비밀번호 <span class="req">*</span></label>
            <input name="password" type="password" placeholder="••••••••" autocomplete="current-password">
            <div class="err">비밀번호를 확인해 주세요.</div>
          </div>
          <button class="btn primary block" type="submit" id="sb">로그인</button>
        </form>
        <div style="text-align:center;margin-top:14px;font-size:14px;color:var(--fg-3)">
          계정이 없으신가요? <a href="#/signup" style="color:var(--accent)">회원가입 신청</a></div>
        <div class="demo-box">
          <b>데모 계정</b>
          <div class="row"><span>화물 운영 담당자</span><button data-fill="operator@sonar.io">operator@sonar.io</button></div>
          <div class="row"><span>시스템 관리자</span><button data-fill="admin@sonar.io">admin@sonar.io</button></div>
          <div class="row"><span>승인 대기 계정</span><button data-fill="park@seah.co.kr">park@seah.co.kr</button></div>
          <div style="margin-top:6px">비밀번호는 모두 <span class="mono">sonar1234</span> 입니다.</div>
          ${isEmbedded() ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
            이 데모는 <b>브라우저 안에서 단독 실행</b>됩니다. 입력한 내용은 저장되지 않고
            새로고침하면 초기 상태로 돌아갑니다. 마음껏 눌러보셔도 됩니다.</div>` : ''}
        </div>
      </div></div></div>`,
    mount(root) {
      const f = root.querySelector('#f');
      root.querySelectorAll('[data-fill]').forEach(b => b.onclick = () => {
        f.email.value = b.dataset.fill; f.password.value = 'sonar1234'; f.email.focus();
      });
      f.onsubmit = async e => {
        e.preventDefault();
        const btn = root.querySelector('#sb'); const errBox = root.querySelector('#err');
        root.querySelectorAll('.field').forEach(x => x.classList.remove('bad'));
        errBox.innerHTML = '';
        btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 확인 중…';
        try {
          const r = await api.post('/auth/login', { email: f.email.value.trim(), password: f.password.value });
          auth.set(r.accessToken, r.user);
          toast(`${r.user.name}님, 환영합니다.`, { type:'ok', title:'로그인 완료' });
          location.hash = r.user.role === 'ADMIN' ? '#/admin' : '#/radar';
        } catch (err) {
          const map = {
            INVALID_CREDENTIALS: ['err', '이메일 또는 비밀번호가 올바르지 않습니다.'],
            ACCOUNT_PENDING:     ['warn', err.message + ' 관리자가 승인하면 로그인할 수 있습니다.'],
            ACCOUNT_REJECTED:    ['err', err.message],
            ACCOUNT_SUSPENDED:   ['err', err.message],
            VALIDATION_ERROR:    ['warn', err.message]
          };
          const [cls, msg] = map[err.code] || ['err', err.message];
          errBox.innerHTML = `<div class="banner ${cls}"><span class="ic">${cls === 'warn' ? '⏳' : '⛔'}</span><div>${esc(msg)}
            <span class="mono muted" style="display:block;margin-top:3px">HTTP ${err.status} · ${esc(err.code)}</span></div></div>`;
          (err.details || []).forEach(d => { const el = root.querySelector(`[data-field="${d.field}"]`); if (el) el.classList.add('bad'); });
          if (err.code === 'INVALID_CREDENTIALS') { root.querySelector('[data-field="password"]').classList.add('bad'); }
        } finally { btn.disabled = false; btn.textContent = '로그인'; }
      };
    }
  };
}

export async function signup() {
  let companies = [];
  try { companies = (await api.get('/companies')).items; } catch {}
  return {
    html: `<div class="auth-wrap">${HERO}
      <div class="auth-panel"><div class="auth-card">
        <h2>회원가입 신청</h2>
        <div class="sub">신청 후 시스템 관리자의 승인이 완료되면 로그인할 수 있습니다.</div>
        <div id="err"></div>
        <form id="f" novalidate>
          <div class="field" data-field="companyId">
            <label>소속 회사 <span class="req">*</span></label>
            <select name="companyId">
              ${companies.map(c => `<option value="${c.companyId}">${esc(c.name)} · ${c.companyType === 'SHIPPER' ? '화주' : '포워더'}</option>`).join('')}
              <option value="__new">+ 신규 회사 등록</option>
            </select>
          </div>
          <div id="newco" style="display:none">
            <div class="grid2">
              <div class="field" data-field="companyName"><label>회사명 <span class="req">*</span></label><input name="companyName" placeholder="(주)회사명"><div class="err">회사명을 입력하세요.</div></div>
              <div class="field" data-field="companyType"><label>구분</label>
                <select name="companyType"><option value="SHIPPER">화주 (수출입 기업)</option><option value="FORWARDER">포워더 / 물류사</option></select></div>
            </div>
          </div>
          <div class="grid2">
            <div class="field" data-field="name"><label>이름 <span class="req">*</span></label><input name="name" placeholder="홍길동"><div class="err">이름을 입력하세요.</div></div>
            <div class="field" data-field="department"><label>부서</label><input name="department" placeholder="글로벌물류팀"></div>
          </div>
          <div class="field" data-field="email"><label>이메일 <span class="req">*</span></label><input name="email" type="email" placeholder="name@company.com"><div class="err">이메일 형식이 올바르지 않습니다.</div></div>
          <div class="grid2">
            <div class="field" data-field="password"><label>비밀번호 <span class="req">*</span></label><input name="password" type="password" placeholder="8자 이상"><div class="err">비밀번호는 8자 이상이어야 합니다.</div></div>
            <div class="field" data-field="phone"><label>연락처</label><input name="phone" placeholder="010-0000-0000"></div>
          </div>
          <button class="btn primary block" type="submit" id="sb">가입 신청</button>
        </form>
        <div style="text-align:center;margin-top:14px;font-size:14px;color:var(--fg-3)">
          이미 계정이 있으신가요? <a href="#/login" style="color:var(--accent)">로그인</a></div>
      </div></div></div>`,
    mount(root) {
      const f = root.querySelector('#f');
      f.companyId.onchange = () => { root.querySelector('#newco').style.display = f.companyId.value === '__new' ? 'block' : 'none'; };
      f.onsubmit = async e => {
        e.preventDefault();
        const btn = root.querySelector('#sb'); const errBox = root.querySelector('#err');
        root.querySelectorAll('.field').forEach(x => x.classList.remove('bad'));
        errBox.innerHTML = '';
        btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 신청 중…';
        const isNew = f.companyId.value === '__new';
        try {
          const r = await api.post('/auth/signup', {
            email: f.email.value.trim(), password: f.password.value, name: f.name.value.trim(),
            phone: f.phone.value.trim() || null, department: f.department.value.trim() || null,
            companyId: isNew ? null : f.companyId.value,
            companyName: isNew ? f.companyName.value.trim() : undefined,
            companyType: isNew ? f.companyType.value : undefined
          });
          errBox.innerHTML = `<div class="banner ok"><span class="ic">✓</span><div><b>가입 신청이 접수되었습니다.</b><br>
            ${esc(r.message)}<br><span class="mono muted">신청 계정: ${esc(r.email)} · 상태 PENDING</span></div></div>`;
          f.reset(); root.querySelector('#newco').style.display = 'none';
        } catch (err) {
          errBox.innerHTML = `<div class="banner err"><span class="ic">⛔</span><div>${esc(err.message)}
            <span class="mono muted" style="display:block;margin-top:3px">HTTP ${err.status} · ${esc(err.code)}</span></div></div>`;
          (err.details || []).forEach(d => { const el = root.querySelector(`[data-field="${d.field}"]`); if (el) el.classList.add('bad'); });
        } finally { btn.disabled = false; btn.textContent = '가입 신청'; }
      };
    }
  };
}
