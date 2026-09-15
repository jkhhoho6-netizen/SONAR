// SONAR - 시스템 관리자 화면
import { api } from '../api.js';
import { esc, money, num, date, dt, pct, grade, chip, riskColor, toast, modal,
  GRADE_LABEL, GRADE_COLOR, EVENT_TYPE_LABEL, EVENT_TYPE_ICON, MATCH_REASON_LABEL,
  SHIPMENT_STATUS, USER_STATUS, EVENT_STATUS, NOTI_STATUS, CHANNEL_LABEL } from '../ui.js';

const GRADES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/* ═══════════ 운영 대시보드 ═══════════ */
export async function overview() {
  const o = await api.get('/admin/overview');
  const p = o.pipeline;
  const stage = (n, v, sub, cls = '') => `<div class="kpi ${cls}"><div class="lb">${n}</div><div class="vl">${v}</div><div class="sx">${sub}</div></div>`;
  return { title:'운영 대시보드', crumb:'플랫폼 전체 현황',
    html:`
    <div class="kpis">
      ${stage('승인 대기 회원', o.users.pending, `전체 ${o.users.total}명 · 활성 ${o.users.active}명`, o.users.pending ? 'med' : '')}
      ${stage('승인 대기 화물', o.shipments.pendingApproval, `전체 ${o.shipments.total}건 · 운송중 ${o.shipments.inTransit}건`, o.shipments.pendingApproval ? 'med' : '')}
      ${stage('검토 대기 이벤트', p.draftEventCount, `발행 ${p.publishedEventCount}건 · 기각 ${p.dismissedEventCount}건`, p.draftEventCount ? 'high' : '')}
      ${stage('승인 대기 알림', o.notifications.pendingApproval, `발송 ${o.notifications.sent}건 · 실패 ${o.notifications.failed}건`, o.notifications.pendingApproval ? 'med' : '')}
      ${stage('전체 영향 건', o.matches.total, `오탐 ${o.matches.falsePositive}건`, 'acc')}
      ${stage('매칭 정확도', o.feedback.precision == null ? '-' : pct(o.feedback.precision), `피드백 ${o.feedback.total}건`, '')}
    </div>

    <div class="cols" style="margin-bottom:16px">
      <div class="card"><div class="hd"><h3>리스크 수집 파이프라인 (FR-01 → FR-02 → FR-03)</h3><span class="sp"></span>
        <span class="meta">최종 수집 ${dt(p.lastCollectedAt)}</span></div>
        <div class="bd">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;align-items:stretch;margin-bottom:16px">
            ${[['수집 소스', `${p.enabledSourceCount}/${p.totalSourceCount}`, '활성 / 전체', '#/admin/sources'],
               ['수집 원문', p.totalFeedCount, `미처리 ${p.pendingFeedCount} · 폐기 ${p.discardedFeedCount}`, '#/admin/feeds'],
               ['정형화 이벤트', p.publishedEventCount + p.draftEventCount, `검토대기 ${p.draftEventCount}`, '#/admin/events'],
               ['영향 건 매칭', o.matches.total, `CRITICAL ${o.matches.byGrade.CRITICAL}`, '#/matches']]
              .map(([t, v, s, h], i) => `<a href="${h}" style="position:relative;padding:18px 16px;border:1px solid var(--line);
                ${i ? 'border-left:none;' : ''}background:var(--panel-2);display:block">
                <div style="font-size:12px;color:var(--fg-3);letter-spacing:.05em">${t}</div>
                <div class="mono" style="font-size:26.5px;font-weight:600;margin:5px 0 3px">${v}</div>
                <div style="font-size:12px;color:var(--fg-3)">${s}</div>
                ${i < 3 ? `<span style="position:absolute;right:-8px;top:50%;transform:translateY(-50%);z-index:2;
                  background:var(--panel);border:1px solid var(--line);border-radius:50%;width:16px;height:16px;
                  display:grid;place-items:center;font-size:10.5px;color:var(--fg-3)">→</span>` : ''}</a>`).join('')}
          </div>
          <h4 style="font-size:12.5px;color:var(--fg-3);letter-spacing:.1em;margin:0 0 9px">최근 수집 작업</h4>
          <table><thead><tr><th>소스</th><th style="width:115px">수집/처리</th><th style="width:115px">상태</th><th style="width:142px">실행</th></tr></thead><tbody>
            ${o.recentJobs.map(j => `<tr><td>${esc(j.sourceName || j.sourceId)}
              ${j.errorMessage ? `<div style="color:var(--warn);font-size:12.5px">${esc(j.errorMessage)}</div>` : ''}</td>
              <td class="mono">${j.fetchedCount} / ${j.processedCount}</td>
              <td>${j.status === 'SUCCESS' ? '<span class="chip ok">성공</span>' : j.status === 'PARTIAL' ? '<span class="chip warn">부분 성공</span>' : '<span class="chip err">실패</span>'}</td>
              <td class="mono" style="font-size:12.5px">${dt(j.startedAt)}</td></tr>`).join('')}
          </tbody></table>
        </div></div>

      <div>
        <div class="card" style="margin-bottom:16px"><div class="hd"><h3>등급별 영향 건</h3></div><div class="bd">
          ${GRADES.map(g => { const c = o.matches.byGrade[g] || 0; const t = Math.max(1, o.matches.total);
            return `<div class="gradebar"><span class="nm" style="color:${GRADE_COLOR[g]}">${GRADE_LABEL[g]}</span>
              <span class="tr"><span class="fl" style="width:${(c / t) * 100}%;background:${GRADE_COLOR[g]}"></span></span>
              <span class="ct">${c}</span></div>`; }).join('')}
          <a class="btn sm block" style="margin-top:12px" href="#/radar">전체 리스크 레이더 열기</a>
        </div></div>
        <div class="card"><div class="hd"><h3>최근 감사 로그</h3><span class="sp"></span>
          <a href="#/admin/audit" style="font-size:12.5px;color:var(--accent)">전체</a></div>
          <div class="bd"><div class="timeline">
            ${o.recentAudits.map(a => `<div class="tl-item"><div class="d">${dt(a.createdAt)} · ${esc(a.actorName)}</div>
              <div class="t"><span class="chip">${esc(a.action)}</span></div>
              <div class="s">${esc(a.detail)}</div></div>`).join('')}
          </div></div></div>
      </div>
    </div>`};
}

/* ═══════════ 리스크 이벤트 모니터링 (핵심) ═══════════ */
export async function eventMonitor() {
  return { title:'리스크 이벤트 모니터링', crumb:'어떤 뉴스로 · 어느 지역에 · 어떤 위험도를 적용 중인가',
    html:`<div class="toolbar">
        <div class="seg" id="s-seg"><button data-s="" class="on">전체</button>
          <button data-s="DRAFT">검토 대기</button><button data-s="PUBLISHED">발행됨</button><button data-s="DISMISSED">기각</button></div>
        <select id="type" style="min-width:150px"><option value="">전체 유형</option>
          ${Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <div class="sp"></div><a class="btn" href="#/admin/feeds">수집 원문 보기 →</a>
      </div>
      <div class="banner info"><span class="ic">ℹ</span><div>
        <b>검토 대기(DRAFT)</b> 이벤트는 아직 담당자 화면에 노출되지 않습니다. 영향 지역과 심각도를 확인한 뒤 <b>발행</b>해야 매칭·알림이 시작됩니다.</div></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { status:'', eventType:'' };
      page.querySelectorAll('#s-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#s-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.status = b.dataset.s; load(); });
      page.querySelector('#type').onchange = e => { st.eventType = e.target.value; load(); };
      async function load() {
        const box = page.querySelector('#list');
        const r = await api.get('/admin/risk-events', st);
        box.innerHTML = `<div class="card"><div class="bd flush"><div class="tbl-wrap"><table style="min-width:1140px"><thead><tr>
          <th style="width:100px">상태</th><th style="min-width:300px">이벤트 (LLM 정형화 결과)</th>
          <th style="width:206px">적용 영향 지역</th>
          <th style="width:118px">심각도·신뢰도</th><th style="width:128px">영향 기간</th>
          <th style="width:80px">매칭</th><th style="width:150px">수집 소스</th></tr></thead><tbody>
          ${r.items.map(e => `<tr class="clickable" data-id="${e.eventId}">
            <td>${chip(EVENT_STATUS, e.status)}</td>
            <td><div style="display:flex;gap:6px;align-items:flex-start">
                <span style="font-size:16px;line-height:1.3">${EVENT_TYPE_ICON[e.eventType] || '•'}</span>
                <div><div>${esc(e.title)}</div>
                <div class="muted" style="font-size:12.5px;margin-top:2px">${esc(EVENT_TYPE_LABEL[e.eventType] || e.eventType)} ·
                  ${esc(e.llmModel || '')} ${e.reviewerName ? `· 검토 ${esc(e.reviewerName)}` : '· <span style="color:var(--warn)">미검토</span>'}</div></div></div></td>
            <td>${e.areaNames.map(a => `<span class="chip" style="margin:1px 2px 1px 0">${esc(a)}</span>`).join('') || '<span class="chip err">미지정</span>'}</td>
            <td><div style="display:flex;align-items:center;gap:5px">
                <span class="mono" style="color:${riskColor(e.severity * 20)}">${e.severity}/5</span>
                <span class="muted" style="font-size:12.5px">· ${pct(e.confidence)}</span></div>
              <div class="muted" style="font-size:12px">가중치 ${e.trustWeight ?? '-'}</div></td>
            <td class="mono" style="font-size:12.5px">${date(e.startDate)}<br>~ ${date(e.expectedEndDate)}</td>
            <td>${e.impactedShipmentCount ? `<span class="badge g-${e.topRiskGrade}"><i></i>${e.impactedShipmentCount}</span>` : '<span class="muted">0</span>'}</td>
            <td style="font-size:12.5px">${esc(e.sourceName || '-')}</td></tr>`).join('')}
        </tbody></table></div></div></div>`;
        box.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/admin/events/${tr.dataset.id}`);
      }
      await load();
    }};
}

/* ═══════════ 이벤트 검토 / 영향 지역 매핑 ═══════════ */
export async function eventReview({ params }) {
  const [e, ports, chokes] = await Promise.all([
    api.get(`/risk-events/${params[0]}`), api.get('/ports'), api.get('/choke-points') ]);
  const areaRow = (a, i) => `<tr data-row="${i}">
    <td><select class="a-type">${['PORT', 'CHOKEPOINT'].map(t => `<option value="${t}" ${a.areaType === t ? 'selected' : ''}>${t === 'PORT' ? '항만' : '해상 요충지'}</option>`).join('')}</select></td>
    <td><select class="a-port" style="${a.areaType === 'PORT' ? '' : 'display:none'}">
        ${ports.items.map(p => `<option value="${p.portId}" ${a.port && a.port.portId === p.portId ? 'selected' : ''}>${esc(p.nameKo)} (${p.unlocode})</option>`).join('')}</select>
      <select class="a-choke" style="${a.areaType === 'CHOKEPOINT' ? '' : 'display:none'}">
        ${chokes.items.map(c => `<option value="${c.chokePointId}" ${a.chokePoint && a.chokePoint.chokePointId === c.chokePointId ? 'selected' : ''}>${esc(c.nameKo)}</option>`).join('')}</select></td>
    <td><input class="a-impact" type="number" min="1" max="5" value="${a.impactLevel}"></td>
    <td><input class="a-delay" type="number" min="0" value="${a.expectedDelayDays}"></td>
    <td><button class="btn sm danger a-del" type="button">삭제</button></td></tr>`;

  return { title:'이벤트 검토', crumb:`${e.eventId} · ${EVENT_STATUS[e.status] ? EVENT_STATUS[e.status][0] : e.status}`,
    html:`<div style="margin-bottom:14px"><a class="btn sm ghost" href="#/admin/events">← 이벤트 모니터링</a></div>
    ${e.status === 'DRAFT' ? `<div class="banner warn"><span class="ic">⏳</span><div>
      <b>검토 대기 상태입니다.</b> 담당자 화면에는 아직 노출되지 않으며 매칭도 수행되지 않습니다.</div></div>` : ''}
    ${e.status === 'DISMISSED' ? `<div class="banner err"><span class="ic">⛔</span><div>
      <b>기각된 이벤트입니다.</b> ${esc(e.reviewNote || '')}</div></div>` : ''}
    <div class="cols"><div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>LLM 정형화 결과 (FR-02) — 수정 가능</h3><span class="sp"></span>
        <span class="meta">${esc(e.llmModel || '')} · ${dt(e.llmExtractedAt)}</span></div><div class="bd">
        <form id="ef">
          <div class="field" data-field="title"><label>제목</label><input name="title" value="${esc(e.title)}"></div>
          <div class="field" data-field="summary"><label>요약</label><textarea name="summary" style="min-height:96px">${esc(e.summary)}</textarea></div>
          <div class="grid3">
            <div class="field" data-field="eventType"><label>유형</label><select name="eventType">
              ${Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${e.eventType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="field" data-field="severity"><label>심각도 (1~5)</label><input name="severity" type="number" min="1" max="5" value="${e.severity}">
              <div class="err">1~5 사이 정수여야 합니다.</div></div>
            <div class="field" data-field="confidence"><label>신뢰도 (0.0~1.0)</label><input name="confidence" type="number" min="0" max="1" step="0.01" value="${e.confidence}">
              <div class="err">0.0~1.0 사이여야 합니다.</div></div>
          </div>
          <div class="grid2">
            <div class="field" data-field="startDate"><label>영향 시작일</label><input name="startDate" type="date" value="${String(e.startDate).slice(0,10)}"></div>
            <div class="field" data-field="expectedEndDate"><label>종료 예상일</label><input name="expectedEndDate" type="date" value="${String(e.expectedEndDate).slice(0,10)}">
              <div class="err">종료일이 시작일보다 빠릅니다.</div></div>
          </div>
          <div class="field" data-field="reviewNote"><label>검토 메모</label><input name="reviewNote" value="${esc(e.reviewNote || '')}" placeholder="판단 근거를 남겨 주세요."></div>
          <button class="btn" type="submit" id="save-ev">정형화 결과 저장</button>
        </form>
      </div></div>

      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>영향 지역 매핑 (FR-02 → FR-03)</h3><span class="sp"></span>
        <button class="btn sm" id="add-area" type="button">＋ 지역 추가</button></div><div class="bd flush">
        <table><thead><tr><th style="width:156px">구분</th><th>지역</th><th style="width:120px">영향도(1~5)</th>
          <th style="width:132px">예상 지연(일)</th><th style="width:89px"></th></tr></thead>
          <tbody id="areas">${e.areas.map(areaRow).join('')}</tbody></table>
        <div style="padding:17px 20px;border-top:1px solid var(--line);display:flex;gap:10px">
          <button class="btn primary" id="save-areas" type="button">영향 지역 저장 후 재매칭</button>
          <button class="btn" id="rematch" type="button">재매칭만 실행</button></div>
      </div></div>

      <div class="card"><div class="hd"><h3>이 이벤트로 산출된 영향 건 (FR-03)</h3><span class="sp"></span>
        <span class="meta">${e.matches.length}건 · 전체 테넌트</span></div><div class="bd flush" id="mtable">
        ${matchTable(e.matches)}</div></div>
    </div>

    <div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>발행 상태</h3><span class="sp"></span>${chip(EVENT_STATUS, e.status)}</div>
        <div class="bd">
          <p class="muted" style="font-size:13px;margin:0 0 12px;line-height:1.6">
            발행하면 해당 회사 담당자 화면에 노출되고, 임계값을 초과한 건에 대해 알림이 발송됩니다.</p>
          <div style="display:grid;gap:8px">
            <button class="btn primary block" id="publish" ${e.status === 'PUBLISHED' ? 'disabled' : ''}>발행 (담당자에게 공개)</button>
            <button class="btn block" id="unpublish" ${e.status === 'PUBLISHED' ? '' : 'disabled'}>발행 취소 (검토 대기로)</button>
            <button class="btn danger block" id="dismiss" ${e.status === 'DISMISSED' ? 'disabled' : ''}>기각 (오탐·미확인)</button>
          </div>
          <dl class="dl" style="margin-top:14px"><dt>검토자</dt><dd>${esc(e.reviewerName || '-')}</dd>
            <dt>검토 일시</dt><dd class="mono">${dt(e.reviewedAt)}</dd>
            <dt>발행 일시</dt><dd class="mono">${dt(e.publishedAt)}</dd></dl>
        </div></div>

      <div class="card"><div class="hd"><h3>수집 원문 (FR-01)</h3></div><div class="bd">
        ${e.source ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px">
            <span class="chip info">${esc(e.source.sourceName)}</span><span class="chip">${esc(e.source.sourceType)}</span>
            <span class="chip">신뢰가중치 ${e.source.trustWeight}</span></div>
          <div style="font-size:14.5px;font-weight:600;line-height:1.5;margin-bottom:9px">${esc(e.source.title)}</div>
          <div style="font-size:13px;color:var(--fg-3);line-height:1.75;max-height:300px;overflow:auto;
            background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:11px">${esc(e.source.body)}</div>
          <dl class="dl" style="margin-top:12px"><dt>발행</dt><dd class="mono">${dt(e.source.publishedAt)}</dd>
            <dt>수집</dt><dd class="mono">${dt(e.source.collectedAt)}</dd></dl>
          <button class="btn sm block" style="margin-top:10px" id="reanalyze">LLM 재분석 실행</button>` : '<div class="muted">원문 없음</div>'}
      </div></div>
    </div></div>`,
    async mount(page) {
      const bindRow = tr => {
        tr.querySelector('.a-type').onchange = ev => {
          tr.querySelector('.a-port').style.display = ev.target.value === 'PORT' ? '' : 'none';
          tr.querySelector('.a-choke').style.display = ev.target.value === 'CHOKEPOINT' ? '' : 'none';
        };
        tr.querySelector('.a-del').onclick = () => tr.remove();
      };
      page.querySelectorAll('#areas tr').forEach(bindRow);
      page.querySelector('#add-area').onclick = () => {
        const tb = page.querySelector('#areas');
        const tmp = document.createElement('tbody');
        tmp.innerHTML = areaRow({ areaType:'PORT', impactLevel:e.severity, expectedDelayDays:3 }, tb.children.length);
        const tr = tmp.firstElementChild; tb.appendChild(tr); bindRow(tr);
      };

      page.querySelector('#ef').onsubmit = async ev => {
        ev.preventDefault();
        const f = ev.target;
        page.querySelectorAll('.field').forEach(x => x.classList.remove('bad'));
        try {
          await api.patch(`/admin/risk-events/${e.eventId}`, { title:f.title.value, summary:f.summary.value,
            eventType:f.eventType.value, severity:Number(f.severity.value), confidence:Number(f.confidence.value),
            startDate:f.startDate.value, expectedEndDate:f.expectedEndDate.value, reviewNote:f.reviewNote.value });
          toast('정형화 결과가 저장되고 전체 재매칭이 수행되었습니다.', { type:'ok' });
          location.reload();
        } catch (err) {
          (err.details || []).forEach(d => { const el = page.querySelector(`[data-field="${d.field}"]`); if (el) el.classList.add('bad'); });
          toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` });
        }
      };

      page.querySelector('#save-areas').onclick = async () => {
        const areas = [...page.querySelectorAll('#areas tr')].map(tr => {
          const t = tr.querySelector('.a-type').value;
          return { areaType:t, portId:t === 'PORT' ? tr.querySelector('.a-port').value : null,
            chokePointId:t === 'CHOKEPOINT' ? tr.querySelector('.a-choke').value : null,
            impactLevel:Number(tr.querySelector('.a-impact').value), expectedDelayDays:Number(tr.querySelector('.a-delay').value) };
        });
        try {
          const r = await api.put(`/admin/risk-events/${e.eventId}/areas`, { areas });
          page.querySelector('#mtable').innerHTML = matchTable(r.matches);
          toast(`영향 지역 ${areas.length}건 저장 · 매칭 ${r.matches.length}건 재산출`, { type:'ok' });
        } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
      };

      page.querySelector('#rematch').onclick = async () => {
        try {
          const r = await api.post(`/admin/risk-events/${e.eventId}/rematch`);
          page.querySelector('#mtable').innerHTML = matchTable(r.matches);
          toast(`재매칭 완료: ${r.before}건 → ${r.after}건`, { type:'ok', title:'FR-03' });
        } catch (err) { toast(err.message, { type:'err' }); }
      };

      const setStatus = async (status, reviewNote) => {
        try { await api.patch(`/admin/risk-events/${e.eventId}/status`, { status, reviewNote });
          toast(`상태가 ${status} 로 변경되었습니다.`, { type:'ok' }); location.reload();
        } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
      };
      page.querySelector('#publish').onclick = () => setStatus('PUBLISHED');
      page.querySelector('#unpublish').onclick = () => setStatus('DRAFT');
      page.querySelector('#dismiss').onclick = () => modal({ title:'이벤트 기각',
        body:`<p style="font-size:14.5px;color:var(--fg-2);margin:0 0 14px">기각하면 매칭이 즉시 제거되고 담당자 화면에서 사라집니다. 사유를 입력하세요.</p>
          <div class="field"><label>기각 사유 <span class="req">*</span></label><textarea id="rn" placeholder="예: 단일 소셜 출처, 교차 검증 불가"></textarea></div>`,
        actions:[{ label:'취소' }, { label:'기각', cls:'danger', onClick:(bg, c) => {
          const v = bg.querySelector('#rn').value.trim();
          if (!v) { toast('기각 사유를 입력해야 합니다.', { type:'err' }); return; } c(); setStatus('DISMISSED', v); }}]});

      const ra = page.querySelector('#reanalyze');
      if (ra) ra.onclick = async () => {
        try { const r = await api.post(`/admin/feeds/${e.source.rawFeedId}/analyze`);
          toast(r.message, { type:'ok', title:'FR-02 LLM 재분석' }); location.reload();
        } catch (err) { toast(err.message, { type:'err' }); }
      };
    }};
}

function matchTable(matches) {
  if (!matches.length) return `<div class="empty"><div class="ic">◎</div><h4>매칭된 화물이 없습니다</h4>
    <p>영향 지역·기간과 겹치는 운송 건이 없습니다. 지역을 추가하거나 기간을 조정해 보세요.</p></div>`;
  return `<div class="tbl-wrap" style="max-height:400px"><table><thead><tr><th style="width:77px">점수</th>
    <th>화물 / 회사</th><th style="width:168px">매칭 근거</th><th style="width:115px">노출일</th><th style="width:96px">등급</th></tr></thead><tbody>
    ${matches.map(m => `<tr><td class="mono" style="font-size:17px;font-weight:600;color:${riskColor(m.riskScore)}">${m.riskScore}</td>
      <td><div class="mono" style="font-size:13px">${esc(m.shipmentNo)}</div>
        <div class="muted" style="font-size:12.5px">${esc(m.companyName || '')} · ${esc(m.commodity)}</div></td>
      <td><div>${esc(m.areaName || '')}</div><div class="muted" style="font-size:12.5px">${esc(MATCH_REASON_LABEL[m.matchReason] || '')}</div></td>
      <td class="mono">${date(m.exposureDate)}</td><td>${grade(m.riskGrade)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ═══════════ 수집 원문 ═══════════ */
export async function feedList() {
  return { title:'수집 원문', crumb:'FR-01 수집 결과 원본',
    html:`<div class="toolbar"><div class="seg" id="s-seg">
        <button data-s="" class="on">전체</button><button data-s="PROCESSED">정형화 완료</button>
        <button data-s="PENDING">미처리</button><button data-s="DISCARDED">폐기</button></div></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { processStatus:'' };
      page.querySelectorAll('#s-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#s-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.processStatus = b.dataset.s; load(); });
      async function load() {
        const r = await api.get('/admin/feeds', st);
        page.querySelector('#list').innerHTML = `<div class="card"><div class="bd flush"><table><thead><tr>
          <th style="width:180px">소스</th><th>원문</th><th style="width:142px">수집</th>
          <th style="width:132px">처리 상태</th><th style="width:120px"></th></tr></thead><tbody>
          ${r.items.map(f => `<tr>
            <td><div>${esc(f.sourceName)}</div><div class="muted mono" style="font-size:12px">${esc(f.sourceType)} · ${f.trustWeight}</div></td>
            <td><div style="font-size:14.5px">${esc(f.title)}</div>
              <div class="muted" style="font-size:12.5px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;
                -webkit-box-orient:vertical;overflow:hidden">${esc(f.body)}</div>
              ${f.discardReason ? `<div style="color:var(--err);font-size:12.5px;margin-top:4px">↳ ${esc(f.discardReason)}</div>` : ''}
              ${f.eventId ? `<div style="margin-top:5px"><a href="#/admin/events/${f.eventId}" style="color:var(--accent);font-size:12.5px">
                → ${esc(f.eventTitle)}</a> ${chip(EVENT_STATUS, f.eventStatus)}</div>` : ''}</td>
            <td class="mono" style="font-size:12.5px">${dt(f.collectedAt)}</td>
            <td>${f.processStatus === 'PROCESSED' ? '<span class="chip ok">정형화 완료</span>'
                : f.processStatus === 'PENDING' ? '<span class="chip warn">미처리</span>' : '<span class="chip err">폐기</span>'}</td>
            <td>${f.processStatus !== 'PROCESSED' ? `<button class="btn sm" data-an="${f.rawFeedId}">LLM 분석</button>` : ''}</td>
          </tr>`).join('')}</tbody></table></div></div>`;
        page.querySelectorAll('[data-an]').forEach(b => b.onclick = async () => {
          b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          try { const r2 = await api.post(`/admin/feeds/${b.dataset.an}/analyze`);
            toast(r2.message, { type:'ok', title:'FR-02' }); location.hash = `#/admin/events/${r2.event.eventId}`;
          } catch (err) { toast(err.message, { type:'err' }); b.disabled = false; b.textContent = 'LLM 분석'; }
        });
      }
      await load();
    }};
}

/* ═══════════ 수집 소스 관리 (FR-08) ═══════════ */
export async function sources() {
  const r = await api.get('/admin/sources');
  return { title:'수집 소스 관리', crumb:'FR-08 소스 · 신뢰가중치 설정',
    html:`<div class="toolbar"><div class="sp"></div><button class="btn primary" id="add">＋ 소스 추가</button></div>
      <div class="banner info"><span class="ic">ℹ</span><div>
        <b>신뢰가중치</b>는 리스크 점수의 신뢰도 계수에 직접 곱해집니다. 값을 변경하면 전체 영향 건이 즉시 재계산됩니다.</div></div>
      <div class="card"><div class="bd flush"><table><thead><tr>
        <th style="width:228px">소스</th><th style="width:115px">유형</th><th>URL</th>
        <th style="width:156px">신뢰가중치</th><th style="width:115px">수집 주기</th>
        <th style="width:132px">수집/이벤트</th><th style="width:115px">상태</th></tr></thead><tbody>
        ${r.items.map(s => `<tr data-id="${s.sourceId}">
          <td><div>${esc(s.name)}</div><div class="muted mono" style="font-size:12px">${esc(s.sourceId)}</div></td>
          <td><span class="chip">${esc(s.sourceType)}</span></td>
          <td class="mono" style="font-size:12.5px;color:var(--fg-3);word-break:break-all">${esc(s.url)}
            ${s.lastJob && s.lastJob.errorMessage ? `<div style="color:var(--warn)">${esc(s.lastJob.errorMessage)}</div>` : ''}</td>
          <td><input class="tw" type="number" min="0" max="1" step="0.01" value="${s.trustWeight}" style="padding:9px 11px;font-size:14px"></td>
          <td class="mono">${s.collectIntervalMin}분</td>
          <td class="mono" style="font-size:12.5px">${s.feedCount} / ${s.eventCount}</td>
          <td><button class="btn sm ${s.enabled ? '' : 'danger'} tg">${s.enabled ? '사용 중' : '중지됨'}</button></td>
        </tr>`).join('')}</tbody></table></div></div>`,
    mount(page) {
      page.querySelectorAll('tr[data-id]').forEach(tr => {
        const id = tr.dataset.id;
        tr.querySelector('.tw').onchange = async ev => {
          try { await api.patch(`/admin/sources/${id}`, { trustWeight:Number(ev.target.value) });
            toast('신뢰가중치가 변경되어 전체 리스크 점수를 재계산했습니다.', { type:'ok' });
          } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status}` }); }
        };
        tr.querySelector('.tg').onclick = async ev => {
          const on = ev.target.textContent.trim() === '사용 중';
          try { await api.patch(`/admin/sources/${id}`, { enabled: !on });
            toast(on ? '수집을 중지했습니다.' : '수집을 재개했습니다.', { type:'ok' }); location.reload();
          } catch (err) { toast(err.message, { type:'err' }); }
        };
      });
      page.querySelector('#add').onclick = () => modal({ title:'수집 소스 추가', body:`<form id="sf">
          <div class="field"><label>소스명 <span class="req">*</span></label><input name="name" placeholder="예: ReCAAP ISC"></div>
          <div class="grid2">
            <div class="field"><label>유형</label><select name="sourceType">
              <option value="NEWS">뉴스</option><option value="GOV">정부·기관 공지</option><option value="NOTICE">선사 공지</option>
              <option value="WEATHER">기상</option><option value="SOCIAL">소셜</option></select></div>
            <div class="field"><label>신뢰가중치 (0~1)</label><input name="trustWeight" type="number" min="0" max="1" step="0.01" value="0.8"></div>
          </div>
          <div class="field"><label>URL <span class="req">*</span></label><input name="url" placeholder="https://..."></div>
          <div class="field"><label>수집 주기 (분)</label><input name="collectIntervalMin" type="number" min="1" value="60"></div>
        </form>`,
        actions:[{ label:'취소' }, { label:'추가', cls:'primary', onClick: async (bg, c) => {
          const f = bg.querySelector('#sf');
          try { await api.post('/admin/sources', { name:f.name.value.trim(), sourceType:f.sourceType.value,
              url:f.url.value.trim(), trustWeight:Number(f.trustWeight.value), collectIntervalMin:Number(f.collectIntervalMin.value) });
            c(); toast('소스가 추가되었습니다.', { type:'ok' }); location.reload();
          } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
        }}]});
    }};
}

/* ═══════════ 임계값 설정 (FR-08) ═══════════ */
export async function thresholds() {
  const r = await api.get('/admin/thresholds');
  return { title:'임계값 · 기준 설정', crumb:'FR-08 등급 기준 및 알림 정책',
    html:`<div style="max-width:880px">
      <div class="banner info"><span class="ic">ℹ</span><div>
        등급 구간은 <b>0~100 사이에서 빈틈 없이 연속</b>되어야 합니다. 저장하면 전체 영향 건의 등급이 즉시 재계산됩니다.</div></div>
      <div class="card"><div class="hd"><h3>리스크 등급 기준</h3></div><div class="bd flush">
        <table><thead><tr><th style="width:144px">등급</th><th style="width:156px">최소 점수</th><th style="width:156px">최대 점수</th>
          <th style="width:144px">알림 발송</th><th style="width:180px">대외 발송 승인</th><th>최근 변경</th></tr></thead>
        <tbody id="rows">${r.items.map(t => `<tr data-g="${t.grade}">
          <td><span class="badge g-${t.grade}"><i></i>${GRADE_LABEL[t.grade]}</span></td>
          <td><input class="mn" type="number" min="0" max="100" value="${t.minScore}" style="padding:9px 11px"></td>
          <td><input class="mx" type="number" min="0" max="100" value="${t.maxScore}" style="padding:9px 11px"></td>
          <td><label class="check" style="padding:6px 2px;border:none;background:none;font-size:13.5px"><input class="ne" type="checkbox" ${t.notifyEnabled ? 'checked' : ''}> 발송</label></td>
          <td><label class="check" style="padding:6px 2px;border:none;background:none;font-size:13.5px"><input class="ra" type="checkbox" ${t.requiresApproval ? 'checked' : ''}> 승인 필요</label></td>
          <td class="mono" style="font-size:12.5px;color:var(--fg-3)">${dt(t.updatedAt)}</td></tr>`).join('')}</tbody></table>
        <div style="padding:17px 20px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:center">
          <button class="btn primary" id="save">저장 후 전체 재계산</button>
          <span id="msg" style="font-size:14px"></span></div>
      </div></div>
      <div class="card" style="margin-top:16px"><div class="hd"><h3>리스크 점수 산식 (읽기 전용)</h3></div><div class="bd">
        <div class="formula">riskScore = 100 × severityFactor × exposureFactor × confidenceFactor</div>
        <table style="margin-top:12px"><thead><tr><th style="width:180px">계수</th><th>구성</th></tr></thead><tbody>
          <tr><td>severityFactor</td><td class="muted">(이벤트 심각도 / 5) × 0.7 + (지역 영향도 / 5) × 0.3</td></tr>
          <tr><td>exposureFactor</td><td class="muted">0.4 + 0.6 × (가액 0.35 + 납기긴급도 0.40 + 경로경직성 0.25)</td></tr>
          <tr><td>confidenceFactor</td><td class="muted">LLM 확신도 × 수집 소스 신뢰가중치</td></tr>
        </tbody></table></div></div></div>`,
    mount(page) {
      page.querySelector('#save').onclick = async () => {
        const items = [...page.querySelectorAll('#rows tr')].map(tr => ({ grade:tr.dataset.g,
          minScore:Number(tr.querySelector('.mn').value), maxScore:Number(tr.querySelector('.mx').value),
          color:GRADE_COLOR[tr.dataset.g], notifyEnabled:tr.querySelector('.ne').checked,
          requiresApproval:tr.querySelector('.ra').checked }));
        const msg = page.querySelector('#msg');
        try { await api.put('/admin/thresholds', { items });
          msg.innerHTML = '<span class="chip ok">저장 완료 · 전체 재계산됨</span>';
          toast('등급 기준이 저장되고 전체 영향 건이 재계산되었습니다.', { type:'ok' });
        } catch (err) { msg.innerHTML = `<span class="chip err">${esc(err.message)}</span>`;
          toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
      };
    }};
}

/* ═══════════ 회원 관리 ═══════════ */
export async function users() {
  return { title:'회원 관리', crumb:'가입 승인 및 권한 관리',
    html:`<div class="toolbar"><div class="seg" id="s-seg">
        <button data-s="" class="on">전체</button><button data-s="PENDING">승인 대기</button>
        <button data-s="ACTIVE">활성</button><button data-s="REJECTED,SUSPENDED">반려·정지</button></div>
        <input id="kw" placeholder="이름·이메일 검색" style="min-width:190px"></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { status:'', keyword:'' };
      page.querySelectorAll('#s-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#s-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.status = b.dataset.s; load(); });
      let t; page.querySelector('#kw').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.keyword = e.target.value; load(); }, 280); };
      async function load() {
        const r = await api.get('/admin/users', st);
        page.querySelector('#list').innerHTML = `<div class="card"><div class="bd flush"><table><thead><tr>
          <th style="width:180px">이름 / 권한</th><th style="width:252px">이메일</th><th>소속</th>
          <th style="width:101px">화물</th><th style="width:142px">신청일</th><th style="width:115px">상태</th>
          <th style="width:204px">처리</th></tr></thead><tbody>
          ${r.items.map(u => `<tr data-id="${u.userId}">
            <td><div>${esc(u.name)}</div><div class="muted" style="font-size:12.5px">${u.role === 'ADMIN' ? '시스템 관리자' : '운영 담당자'} · ${esc(u.department || '-')}</div></td>
            <td class="mono" style="font-size:13px">${esc(u.email)}</td>
            <td><div>${esc(u.companyName || '-')}</div>
              <div class="muted" style="font-size:12.5px">${u.companyType === 'SHIPPER' ? '화주' : u.companyType === 'FORWARDER' ? '포워더' : '-'}</div>
              ${u.rejectReason ? `<div style="color:var(--err);font-size:12.5px;margin-top:3px">↳ ${esc(u.rejectReason)}</div>` : ''}</td>
            <td class="mono">${u.shipmentCount}</td>
            <td class="mono" style="font-size:12.5px">${dt(u.createdAt)}</td>
            <td>${chip(USER_STATUS, u.status)}</td>
            <td>${u.status === 'PENDING'
              ? `<button class="btn sm primary" data-ok="${u.userId}">승인</button>
                 <button class="btn sm danger" data-no="${u.userId}">반려</button>`
              : u.status === 'ACTIVE' ? `<button class="btn sm" data-sus="${u.userId}">정지</button>`
              : `<button class="btn sm" data-ok="${u.userId}">활성화</button>`}</td></tr>`).join('')}
        </tbody></table></div></div>`;
        const act = async (id, status, reason) => {
          try { await api.patch(`/admin/users/${id}/status`, { status, reason });
            toast(`사용자 상태가 ${status} 로 변경되었습니다.`, { type:'ok' }); load();
          } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
        };
        page.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 'ACTIVE'));
        page.querySelectorAll('[data-sus]').forEach(b => b.onclick = () => act(b.dataset.sus, 'SUSPENDED'));
        page.querySelectorAll('[data-no]').forEach(b => b.onclick = () => modal({ title:'가입 반려',
          body:`<div class="field"><label>반려 사유 <span class="req">*</span></label>
            <textarea id="rn" placeholder="반려 사유를 입력하세요. 신청자에게 표시됩니다."></textarea></div>`,
          actions:[{ label:'취소' }, { label:'반려', cls:'danger', onClick:(bg, c) => {
            const v = bg.querySelector('#rn').value.trim();
            if (!v) { toast('반려 사유를 입력해야 합니다.', { type:'err' }); return; } c(); act(b.dataset.no, 'REJECTED', v); }}]}));
      }
      await load();
    }};
}

/* ═══════════ 화물 등록 승인 ═══════════ */
export async function shipmentApproval() {
  return { title:'화물 등록 승인', crumb:'등록 신청 건 검토',
    html:`<div class="toolbar"><div class="seg" id="s-seg">
        <button data-s="PENDING_APPROVAL" class="on">승인 대기</button><button data-s="">전체</button>
        <button data-s="IN_TRANSIT,ACTIVE">승인 완료</button><button data-s="REJECTED">반려</button></div>
        <input id="kw" placeholder="화물번호·품목 검색" style="min-width:190px"></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { status:'PENDING_APPROVAL', keyword:'' };
      page.querySelectorAll('#s-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#s-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.status = b.dataset.s; load(); });
      let t; page.querySelector('#kw').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.keyword = e.target.value; load(); }, 280); };
      async function load() {
        const r = await api.get('/admin/shipments', st);
        if (!r.items.length) { page.querySelector('#list').innerHTML = `<div class="card"><div class="bd">
          <div class="empty"><div class="ic">✓</div><h4>처리할 건이 없습니다</h4><p>승인 대기 중인 화물 등록 신청이 없습니다.</p></div></div></div>`; return; }
        page.querySelector('#list').innerHTML = `<div class="card"><div class="bd flush"><table><thead><tr>
          <th style="width:151px">화물번호</th><th>품목 / 회사</th><th style="width:228px">운송 구간</th>
          <th style="width:127px">가액</th><th style="width:132px">일정</th><th style="width:125px">잠정 리스크</th>
          <th style="width:132px">상태</th><th style="width:202px">처리</th></tr></thead><tbody>
          ${r.items.map(s => `<tr data-id="${s.shipmentId}">
            <td><div class="mono" style="font-size:13px">${esc(s.shipmentNo)}</div>
              <div class="muted" style="font-size:12px">${dt(s.createdAt)}</div></td>
            <td><div>${esc(s.commodity)}</div>
              <div class="muted" style="font-size:12.5px">${esc(s.companyName)} · ${esc(s.ownerName || '')}</div></td>
            <td><div>${esc(s.originPort.nameKo)} → ${esc(s.destinationPort.nameKo)}</div>
              <div class="muted" style="font-size:12.5px">${esc(s.vessel ? s.vessel.vesselName : '선박 미배정')}</div></td>
            <td class="mono">${money(s.cargoValueUsd)}</td>
            <td class="mono" style="font-size:12.5px">${date(s.etd)}<br><span class="muted">${date(s.eta)}</span></td>
            <td>${s.topRiskGrade === 'NONE' ? '<span class="chip ok">영향 없음</span>'
              : `<span class="mono" style="font-size:17px;font-weight:600;color:${riskColor(s.topRiskScore)}">${s.topRiskScore}</span> ${grade(s.topRiskGrade)}`}</td>
            <td>${chip(SHIPMENT_STATUS, s.status)}</td>
            <td>${s.status === 'PENDING_APPROVAL'
              ? `<button class="btn sm primary" data-ok="${s.shipmentId}">승인</button>
                 <button class="btn sm danger" data-no="${s.shipmentId}">반려</button>`
              : `<a class="btn sm" href="#/shipments/${s.shipmentId}">상세</a>`}</td></tr>`).join('')}
        </tbody></table></div></div>`;
        const act = async (id, decision, reason) => {
          try { await api.patch(`/admin/shipments/${id}/approval`, { decision, reason });
            toast(decision === 'APPROVE' ? '승인되었습니다. 정식 모니터링 대상으로 전환됩니다.' : '반려 처리되었습니다.', { type:'ok' }); load();
          } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
        };
        page.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 'APPROVE'));
        page.querySelectorAll('[data-no]').forEach(b => b.onclick = () => modal({ title:'화물 등록 반려',
          body:`<div class="field"><label>반려 사유 <span class="req">*</span></label>
            <textarea id="rn" placeholder="예: 인보이스 가액과 첨부 P/L 금액 불일치"></textarea></div>`,
          actions:[{ label:'취소' }, { label:'반려', cls:'danger', onClick:(bg, c) => {
            const v = bg.querySelector('#rn').value.trim();
            if (!v) { toast('반려 사유를 입력해야 합니다.', { type:'err' }); return; } c(); act(b.dataset.no, 'REJECT', v); }}]}));
      }
      await load();
    }};
}

/* ═══════════ 알림 발송 승인 (FR-07) ═══════════ */
export async function notificationApproval() {
  return { title:'알림 발송 승인', crumb:'FR-07 대외 발송 건 승인',
    html:`<div class="toolbar"><div class="seg" id="s-seg">
        <button data-s="PENDING_APPROVAL" class="on">승인 대기</button><button data-s="">전체</button>
        <button data-s="SENT">발송 완료</button><button data-s="FAILED,REJECTED">실패·반려</button></div></div>
      <div class="banner info"><span class="ic">ℹ</span><div>
        고객사 등 <b>대외 수신자</b>에게 나가는 알림은 관리자 승인 후 발송됩니다. 사내 알림은 임계값 초과 시 자동 발송됩니다.</div></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { status:'PENDING_APPROVAL' };
      page.querySelectorAll('#s-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#s-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.status = b.dataset.s; load(); });
      async function load() {
        const r = await api.get('/admin/notifications', st);
        if (!r.items.length) { page.querySelector('#list').innerHTML = `<div class="card"><div class="bd">
          <div class="empty"><div class="ic">✉</div><h4>처리할 알림이 없습니다</h4><p>승인 대기 중인 대외 발송 건이 없습니다.</p></div></div></div>`; return; }
        page.querySelector('#list').innerHTML = `<div class="card"><div class="bd flush"><table><thead><tr>
          <th style="width:127px">채널·범위</th><th>내용</th><th style="width:156px">요청자</th>
          <th style="width:142px">요청 일시</th><th style="width:127px">상태</th><th style="width:202px">처리</th></tr></thead><tbody>
          ${r.items.map(n => `<tr>
            <td><div class="chip">${esc(CHANNEL_LABEL[n.channel] || n.channel)}</div>
              <div style="margin-top:3px">${n.scope === 'EXTERNAL' ? '<span class="chip warn">대외</span>' : '<span class="chip">사내</span>'}</div></td>
            <td><div style="font-size:14.5px">${esc(n.title)}</div>
              <div class="muted" style="font-size:13px;margin-top:2px">${esc(n.message)}</div>
              ${n.failReason ? `<div style="color:var(--err);font-size:12.5px;margin-top:3px">↳ ${esc(n.failReason)}</div>` : ''}
              ${n.matchId ? `<a href="#/matches/${n.matchId}" style="color:var(--accent);font-size:12.5px">→ 영향 건 ${esc(n.shipmentNo || '')}</a>` : ''}</td>
            <td>${esc(n.requesterName || n.requestedBy)}</td>
            <td class="mono" style="font-size:12.5px">${dt(n.createdAt)}</td>
            <td>${chip(NOTI_STATUS, n.status)}</td>
            <td>${n.status === 'PENDING_APPROVAL'
              ? `<button class="btn sm primary" data-ok="${n.notificationId}">승인·발송</button>
                 <button class="btn sm danger" data-no="${n.notificationId}">반려</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`;
        const act = async (id, decision, reason) => {
          try { await api.patch(`/admin/notifications/${id}/approval`, { decision, reason });
            toast(decision === 'APPROVE' ? '승인되어 발송되었습니다.' : '반려 처리되었습니다.', { type:'ok' }); load();
          } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
        };
        page.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 'APPROVE'));
        page.querySelectorAll('[data-no]').forEach(b => b.onclick = () => modal({ title:'알림 발송 반려',
          body:`<div class="field"><label>반려 사유 <span class="req">*</span></label><textarea id="rn"></textarea></div>`,
          actions:[{ label:'취소' }, { label:'반려', cls:'danger', onClick:(bg, c) => {
            const v = bg.querySelector('#rn').value.trim();
            if (!v) { toast('반려 사유를 입력해야 합니다.', { type:'err' }); return; } c(); act(b.dataset.no, 'REJECT', v); }}]}));
      }
      await load();
    }};
}

/* ═══════════ 매칭 피드백 (FR-09) ═══════════ */
export async function feedback() {
  const f = await api.get('/admin/feedback-summary');
  return { title:'매칭 피드백', crumb:'FR-09 오탐 관리 및 매칭 정확도',
    html:`<div class="kpis">
        <div class="kpi acc"><div class="lb">매칭 정확도 (Precision)</div><div class="vl">${f.precision == null ? '-' : pct(f.precision)}</div>
          <div class="sx">피드백 ${f.total}건 기준</div></div>
        <div class="kpi"><div class="lb">실제 영향 확인</div><div class="vl">${f.relevant}</div><div class="sx">유효 매칭</div></div>
        <div class="kpi crit"><div class="lb">오탐 신고</div><div class="vl">${f.falsePositive}</div><div class="sx">매칭 규칙 개선 대상</div></div>
        <div class="kpi"><div class="lb">평균 실제 지연</div><div class="vl">${f.avgActualDelayDays ?? '-'}<span style="font-size:16px">일</span></div>
          <div class="sx">예측 검증용</div></div>
      </div>
      <div class="cols">
        <div class="card"><div class="hd"><h3>피드백 상세</h3></div><div class="bd flush">
          ${f.items.length ? `<table><thead><tr><th style="width:132px">판정</th><th>의견</th>
            <th style="width:132px">실제 지연</th><th style="width:156px">작성자</th><th style="width:142px">일시</th></tr></thead><tbody>
            ${f.items.map(x => `<tr class="clickable" data-id="${x.matchId}">
              <td>${x.isRelevant ? '<span class="chip ok">실제 영향</span>' : '<span class="chip err">오탐</span>'}</td>
              <td>${esc(x.comment || '-')}</td>
              <td class="mono">${x.actualDelayDays == null ? '-' : x.actualDelayDays + '일'}</td>
              <td>${esc(x.userName || '')}</td><td class="mono" style="font-size:12.5px">${dt(x.createdAt)}</td></tr>`).join('')}
          </tbody></table>` : `<div class="empty"><div class="ic">◐</div><h4>피드백이 없습니다</h4>
            <p>담당자가 영향 건 상세에서 오탐 여부를 라벨링하면 이곳에 집계됩니다.</p></div>`}
        </div></div>
        <div class="card"><div class="hd"><h3>이벤트별 오탐율</h3></div><div class="bd">
          ${f.byEvent.length ? f.byEvent.map(b => `<div style="margin-bottom:12px">
            <div style="font-size:14px;margin-bottom:5px">${esc(b.eventTitle || b.eventId)}</div>
            <div class="gradebar"><span class="nm">오탐</span>
              <span class="tr"><span class="fl" style="width:${(b.falsePositive / b.total) * 100}%;background:var(--g-crit)"></span></span>
              <span class="ct">${b.falsePositive}/${b.total}</span></div></div>`).join('')
            : '<div class="muted" style="font-size:14px">집계된 데이터가 없습니다.</div>'}
        </div></div>
      </div>`,
    mount(page) { page.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/matches/${tr.dataset.id}`); }};
}

/* ═══════════ 감사 로그 ═══════════ */
export async function audit() {
  const r = await api.get('/admin/audit-logs', { size: 100 });
  return { title:'감사 로그', crumb:'시스템 변경 이력',
    html:`<div class="card"><div class="bd flush"><table><thead><tr>
      <th style="width:156px">일시</th><th style="width:144px">수행자</th><th style="width:216px">액션</th>
      <th style="width:180px">대상</th><th>내용</th><th style="width:132px">IP</th></tr></thead><tbody>
      ${r.items.map(a => `<tr><td class="mono" style="font-size:12.5px">${dt(a.createdAt)}</td>
        <td>${esc(a.actorName)}</td><td><span class="chip">${esc(a.action)}</span></td>
        <td class="mono" style="font-size:12.5px">${esc(a.targetType)} / ${esc(a.targetId)}</td>
        <td>${esc(a.detail)}</td><td class="mono" style="font-size:12.5px;color:var(--fg-3)">${esc(a.ip)}</td></tr>`).join('')}
    </tbody></table></div></div>`};
}
