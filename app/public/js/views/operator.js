// SONAR - 화물 운영 담당자 화면
import { api, auth } from '../api.js';
import { createMap } from '../map.js';
import { esc, money, num, date, dt, pct, grade, chip, riskColor, toast, modal, daysLeft,
  GRADE_LABEL, GRADE_COLOR, EVENT_TYPE_LABEL, EVENT_TYPE_ICON, MATCH_REASON_LABEL,
  SHIPMENT_STATUS, MATCH_STATUS, NOTI_STATUS, CHANNEL_LABEL, ACTION_TYPE, ACTION_RESULT } from '../ui.js';

const GRADES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/* ═══════════ FR-05 리스크 레이더 (지도 대시보드) ═══════════ */
export async function radar({ user }) {
  return {
    title: '리스크 레이더', crumb: user.role === 'ADMIN' ? '전체 테넌트 / 실시간 관제' : `${user.companyName} / 실시간 관제`,
    html: `<div class="radar">
      <div class="mapbox">
        <div id="map"></div>
        <div class="map-fallback-note"></div>
        <div class="map-tools">
          <div class="seg" id="scope-seg">
            <button data-scope="" class="on">전체 화물</button><button data-scope="mine">내 담당</button>
          </div>
          <div class="seg" id="layer-seg">
            <button data-layer="zones" class="on">리스크 구역</button><button data-layer="routes" class="on">항로</button>
          </div>
          <button class="btn sm" id="reset-view">전체 보기</button>
        </div>
        <div class="map-legend">
          <div class="t">RISK SCORE</div>
          <div class="scale"></div>
          <div class="ends"><span>0 안전</span><span>100 심각</span></div>
          <div class="lg"><i style="background:#fff"></i> 선박 (현재 위치) — 색상 = 리스크 점수</div>
          <div class="lg"><i style="background:transparent;border-style:dashed"></i> 점선 테두리 = 승인 대기 화물</div>
          <div class="lg"><i style="background:rgba(255,59,82,.25);border-color:#ff3b52"></i> 리스크 영향 구역</div>
        </div>
      </div>
      <aside class="rail" id="rail"><div class="loading"><span class="spin"></span></div></aside>
    </div>`,
    async mount(page) {
      const el = page.querySelector('#map');
      const rail = page.querySelector('#rail');
      let scope = '', gradeFilter = '', showZones = true, showRoutes = true;

      const map = createMap(el, { onSelect: (v, open) => {
        if (open) { location.hash = `#/shipments/${v.shipments[0].shipmentId}`; return; }
        highlight(v.voyageId);
      }});

      function highlight(voyageId) {
        rail.querySelectorAll('.risk-item').forEach(n => n.style.outline = '');
        rail.querySelectorAll(`.risk-item[data-voyage="${voyageId}"]`).forEach(n => {
          n.style.outline = '1px solid var(--accent)'; n.scrollIntoView({ block:'nearest', behavior:'smooth' });
        });
      }

      async function load() {
        const [sum, mapData] = await Promise.all([
          api.get('/dashboard/summary', { scope }),
          api.get('/dashboard/map', { scope, grade: gradeFilter })
        ]);
        map.render({ vessels: mapData.vessels, riskZones: mapData.riskZones, showZones, showRoutes });
        renderRail(sum, mapData);
      }

      function renderRail(s, mapData) {
        const total = Math.max(1, s.totalMatchCount);
        const bars = GRADES.map(g => {
          const c = s.gradeCounts[g] || 0;
          return `<div class="gradebar" data-grade="${g}">
            <span class="nm" style="color:${GRADE_COLOR[g]}">${GRADE_LABEL[g]}</span>
            <span class="tr"><span class="fl" style="width:${(c / total) * 100}%;background:${GRADE_COLOR[g]}"></span></span>
            <span class="ct">${c}</span></div>`;
        }).join('');
        rail.innerHTML = `
          <div class="sec">
            <h4>노출 현황 <span class="sp"></span><span class="muted mono">${date(s.baseDate)}</span></h4>
            <div class="kpis" style="grid-template-columns:1fr 1fr;gap:12px;margin:0">
              <div class="kpi crit" style="padding:15px 17px"><div class="lb">긴급 대응 필요</div>
                <div class="vl">${(s.gradeCounts.CRITICAL || 0) + (s.gradeCounts.HIGH || 0)}</div><div class="sx">심각 + 높음</div></div>
              <div class="kpi acc" style="padding:15px 17px"><div class="lb">영향 화물</div>
                <div class="vl">${s.exposedShipmentCount}</div><div class="sx">추적 ${s.trackedShipmentCount}건 중</div></div>
              <div class="kpi" style="padding:15px 17px"><div class="lb">노출 화물가액</div>
                <div class="vl" style="font-size:22px">${money(s.exposedCargoValueUsd)}</div><div class="sx">영향 건 합계</div></div>
              <div class="kpi" style="padding:15px 17px"><div class="lb">최대 예상 지연</div>
                <div class="vl">${s.maxExpectedDelayDays}<span style="font-size:16px">일</span></div><div class="sx">미조치 ${s.openMatchCount}건</div></div>
            </div>
          </div>
          <div class="sec"><h4>등급별 영향 건 <span class="sp"></span>
            ${gradeFilter ? `<button class="btn sm ghost" id="clear-grade">필터 해제</button>` : ''}</h4>
            <div class="gradebars">${bars}</div></div>
          <div class="sec"><h4>진행 중 리스크 이벤트</h4>
            ${s.topEvents.length ? s.topEvents.map(e => `
              <a class="risk-item gb-${e.topRiskGrade}" href="#/events/${e.eventId}" style="display:block">
                <div class="r1"><span>${EVENT_TYPE_ICON[e.eventType] || '•'}</span>
                  <span class="no">${esc(EVENT_TYPE_LABEL[e.eventType] || e.eventType)}</span>
                  <span class="sc" style="color:${riskColor(e.myTopRiskScore)}">${e.myTopRiskScore}</span></div>
                <div class="ti">${esc(e.title)}</div>
                <div class="mt"><span>영향 ${e.myImpactedCount}건</span><span>심각도 ${e.severity}/5</span><span>신뢰도 ${pct(e.confidence)}</span></div>
              </a>`).join('') : `<div class="muted" style="font-size:14px">진행 중인 영향 이벤트가 없습니다.</div>`}
          </div>
          <div class="sec"><h4>우선순위 영향 건 <span class="sp"></span><a href="#/matches" style="font-size:12.5px;color:var(--accent)">전체 보기</a></h4>
            ${s.priorityMatches.length ? s.priorityMatches.map(m => {
              const v = mapData.vessels.find(x => x.shipments.some(y => y.shipmentId === m.shipmentId));
              const dl = daysLeft(m.exposureDate);
              return `<div class="risk-item gb-${m.riskGrade}" data-match="${m.matchId}" data-voyage="${v ? v.voyageId : ''}">
                <div class="r1"><span class="no">${esc(m.shipmentNo)}</span>
                  ${m.provisional ? '<span class="chip warn" style="font-size:11px;padding:1px 5px">승인대기</span>' : ''}
                  <span class="sc" style="color:${riskColor(m.riskScore)}">${m.riskScore}</span></div>
                <div class="ti">${esc(m.commodity)} · ${esc(m.areaName || '')} ${esc(MATCH_REASON_LABEL[m.matchReason] || '')}</div>
                <div class="mt"><span>${date(m.exposureDate)}${dl != null ? ` (D${dl >= 0 ? '-' + dl : '+' + -dl})` : ''}</span>
                  <span>지연 +${m.expectedDelayDays}일</span><span>여유 ${m.bufferDays}일</span></div>
              </div>`;
            }).join('') : `<div class="empty" style="padding:30px 12px"><div class="ic">◎</div><h4>영향 건 없음</h4>
                <p>현재 등록된 화물 중 진행 중인 리스크 이벤트에 노출된 건이 없습니다.</p></div>`}
          </div>`;

        rail.querySelectorAll('.gradebar').forEach(b => b.onclick = () => {
          gradeFilter = gradeFilter === b.dataset.grade ? '' : b.dataset.grade; load();
        });
        const cg = rail.querySelector('#clear-grade'); if (cg) cg.onclick = () => { gradeFilter = ''; load(); };
        rail.querySelectorAll('.risk-item[data-match]').forEach(n => {
          n.onclick = () => location.hash = `#/matches/${n.dataset.match}`;
          n.onmouseenter = () => { if (n.dataset.voyage) map.select(n.dataset.voyage, false); };
        });
      }

      page.querySelectorAll('#scope-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#scope-seg button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); scope = b.dataset.scope; load();
      });
      page.querySelectorAll('#layer-seg button').forEach(b => b.onclick = () => {
        b.classList.toggle('on');
        if (b.dataset.layer === 'zones') showZones = b.classList.contains('on'); else showRoutes = b.classList.contains('on');
        map.render({ showZones, showRoutes });
      });
      page.querySelector('#reset-view').onclick = () => map.reset();
      await load();
    }
  };
}

/* ═══════════ 영향 건 목록 ═══════════ */
export async function matchList({ user }) {
  return { title:'영향 건 목록', crumb:'FR-03 매칭 결과 / FR-04 리스크 점수',
    html:`<div class="toolbar">
        <div class="seg" id="g-seg"><button data-g="" class="on">전체 등급</button>
          ${GRADES.map(g => `<button data-g="${g}">${GRADE_LABEL[g]}</button>`).join('')}</div>
        <div class="seg" id="s-seg"><button data-s="" class="on">전체 상태</button>
          <button data-s="OPEN">미조치</button><button data-s="ACTION_TAKEN">조치 완료</button><button data-s="FALSE_POSITIVE">오탐</button></div>
        <div class="seg" id="sc-seg"><button data-sc="" class="on">회사 전체</button><button data-sc="mine">내 담당</button></div>
        <div class="sp"></div>
        <select id="sort" style="min-width:132px"><option value="score">리스크 점수순</option><option value="date">노출일 임박순</option></select>
      </div>
      <div class="card"><div class="bd flush"><div id="list"><div class="loading"><span class="spin"></span></div></div></div></div>`,
    async mount(page) {
      const st = { grade:'', status:'', scope:'', sort:'score' };
      const bind = (sel, key, attr) => page.querySelectorAll(`${sel} button`).forEach(b => b.onclick = () => {
        page.querySelectorAll(`${sel} button`).forEach(x => x.classList.remove('on')); b.classList.add('on');
        st[key] = b.dataset[attr]; load();
      });
      bind('#g-seg', 'grade', 'g'); bind('#s-seg', 'status', 's'); bind('#sc-seg', 'scope', 'sc');
      page.querySelector('#sort').onchange = e => { st.sort = e.target.value; load(); };

      async function load() {
        const box = page.querySelector('#list');
        box.innerHTML = `<div class="loading"><span class="spin"></span></div>`;
        const r = await api.get('/matches', st);
        if (!r.items.length) { box.innerHTML = `<div class="empty"><div class="ic">▤</div><h4>조건에 맞는 영향 건이 없습니다</h4>
          <p>필터를 변경하거나, 화물을 등록하면 진행 중인 리스크 이벤트와 자동으로 매칭됩니다.</p></div>`; return; }
        box.innerHTML = `<div class="tbl-wrap"><table><thead><tr>
          <th style="width:89px">점수</th><th style="width:144px">화물번호</th><th>리스크 이벤트</th>
          <th style="width:180px">매칭 근거</th><th style="width:115px">노출일</th><th style="width:94px">납기여유</th>
          <th style="width:94px">예상지연</th><th style="width:110px">상태</th></tr></thead><tbody>
          ${r.items.map(m => { const dl = daysLeft(m.exposureDate); return `<tr class="clickable" data-id="${m.matchId}">
            <td><span class="mono" style="font-size:18.5px;font-weight:600;color:${riskColor(m.riskScore)}">${m.riskScore}</span></td>
            <td><div class="mono" style="font-size:13px">${esc(m.shipmentNo)}</div>
                <div class="muted" style="font-size:12.5px">${esc(m.commodity)}</div>
                ${m.provisional ? '<span class="chip warn" style="font-size:11px;margin-top:3px">승인 대기</span>' : ''}</td>
            <td><div style="display:flex;align-items:center;gap:6px">${EVENT_TYPE_ICON[m.eventType] || '•'}
                <span>${esc(m.eventTitle)}</span></div>
                <div class="muted" style="font-size:12.5px;margin-top:2px">${esc(m.originPort.nameKo)} → ${esc(m.destinationPort.nameKo)} · ${esc(m.vesselName || '선박 미배정')}</div></td>
            <td><div>${esc(m.areaName || '-')}</div><div class="muted" style="font-size:12.5px">${esc(MATCH_REASON_LABEL[m.matchReason] || m.matchReason)}</div></td>
            <td class="mono">${date(m.exposureDate)}<div class="muted" style="font-size:12px">${dl != null ? (dl >= 0 ? `D-${dl}` : `D+${-dl}`) : ''}</div></td>
            <td class="mono ${m.bufferDays <= 3 ? '' : 'muted'}" style="${m.bufferDays <= 3 ? 'color:var(--g-crit)' : ''}">${m.bufferDays}일</td>
            <td class="mono">+${m.expectedDelayDays}일</td>
            <td>${grade(m.riskGrade)}<div style="margin-top:3px">${chip(MATCH_STATUS, m.status)}</div></td></tr>`; }).join('')}
          </tbody></table></div>
          <div style="padding:15px 18px;border-top:1px solid var(--line);font-size:13px;color:var(--fg-3)" class="mono">
            총 ${r.total}건 · ${r.page}/${r.totalPages} 페이지</div>`;
        box.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/matches/${tr.dataset.id}`);
      }
      await load();
    }};
}

/* ═══════════ FR-06 영향 건 상세 · 대응안 · 조치 등록 ═══════════ */
export async function matchDetail({ params }) {
  const [m, pb] = await Promise.all([ api.get(`/matches/${params[0]}`), api.get(`/matches/${params[0]}/playbooks`) ]);
  const b = m.scoreBreakdown;
  const dl = daysLeft(m.exposureDate);
  return { title:`영향 건 ${m.shipmentNo}`, crumb:`${m.matchId} · ${EVENT_TYPE_LABEL[m.eventType] || m.eventType}`,
    html:`
    <div style="margin-bottom:14px"><a class="btn sm ghost" href="#/matches">← 영향 건 목록</a></div>
    ${m.provisional ? `<div class="banner warn"><span class="ic">⏳</span><div><b>관리자 승인 전 잠정 분석 결과입니다.</b><br>
      화물 등록이 승인되면 정식 모니터링 대상으로 전환되고 알림이 발송됩니다.</div></div>` : ''}
    ${m.status === 'FALSE_POSITIVE' ? `<div class="banner err"><span class="ic">⚑</span><div><b>오탐으로 신고된 건입니다.</b><br>
      매칭 정확도 개선을 위해 관리자에게 전달되었습니다.</div></div>` : ''}
    <div class="cols">
      <div>
        <div class="score-hero" style="margin-bottom:16px">
          <div class="num" style="color:${riskColor(m.riskScore)}">${m.riskScore}</div>
          <div class="desc">
            <div style="margin-bottom:6px">${grade(m.riskGrade)} ${chip(MATCH_STATUS, m.status)}</div>
            <b style="color:var(--fg)">${esc(m.eventTitle)}</b> 로 인해<br>
            <b style="color:var(--fg)">${esc(m.shipmentNo)} (${esc(m.commodity)})</b> 가
            <b style="color:var(--fg)">${date(m.exposureDate)}</b> ${esc(m.areaName)} ${esc(MATCH_REASON_LABEL[m.matchReason] || '')} 시점에 노출됩니다.
            예상 지연 <b style="color:var(--g-high)">+${m.expectedDelayDays}일</b>, 납기 여유 <b style="color:${m.bufferDays <= 3 ? 'var(--g-crit)' : 'var(--fg)'}">${m.bufferDays}일</b>.
          </div>
        </div>

        <div class="card" style="margin-bottom:16px"><div class="hd"><h3>리스크 점수 산출 근거 (FR-04)</h3>
          <span class="sp"></span><span class="meta">${dl != null ? (dl >= 0 ? `노출까지 D-${dl}` : `노출 후 ${-dl}일 경과`) : ''}</span></div>
          <div class="bd">
            <div class="formula">${esc(b.formula)}</div>
            <div class="formula" style="margin-top:7px;color:var(--accent)">${m.riskScore} = 100 × ${b.severityFactor} × ${b.exposureFactor} × ${b.confidenceFactor}</div>
            <div class="factorbars">
              <div class="factorbar"><div class="t"><span>심각도 Severity — 이벤트 ${b.severityRaw}/5 × 지역 영향도</span><span>${b.severityFactor}</span></div>
                <div class="tr"><div class="fl" style="width:${b.severityFactor * 100}%"></div></div></div>
              <div class="factorbar"><div class="t"><span>노출도 Exposure — 가액 · 납기여유 · 대체경로</span><span>${b.exposureFactor}</span></div>
                <div class="tr"><div class="fl" style="width:${b.exposureFactor * 100}%"></div></div></div>
              <div class="factorbar"><div class="t"><span>신뢰도 Confidence — LLM 확신도 × 소스 신뢰가중치</span><span>${b.confidenceFactor}</span></div>
                <div class="tr"><div class="fl" style="width:${b.confidenceFactor * 100}%"></div></div></div>
            </div>
            <table style="margin-top:14px"><thead><tr><th>노출도 세부</th><th style="width:115px">값</th><th style="width:89px">가중치</th><th>설명</th></tr></thead><tbody>
              <tr><td>화물 가액</td><td class="mono">${b.exposureDetail.valueNorm}</td><td class="mono muted">0.35</td><td class="muted">${money(m.cargoValueUsd)} / 기준 $2,000,000</td></tr>
              <tr><td>납기 긴급도</td><td class="mono">${b.exposureDetail.urgency}</td><td class="mono muted">0.40</td><td class="muted">납기 여유 ${m.bufferDays}일 / 기준 21일</td></tr>
              <tr><td>경로 경직성</td><td class="mono">${b.exposureDetail.routeRigidity}</td><td class="mono muted">0.25</td><td class="muted">대체 경로 ${m.shipment.alternativeRouteAvailable ? '있음 (0.35)' : '없음 (1.00)'}</td></tr>
            </tbody></table>
          </div></div>

        <div class="card" style="margin-bottom:16px"><div class="hd"><h3>대응 시나리오 (FR-06)</h3><span class="sp"></span>
          <span class="meta">${pb.total}개 제안 · ${GRADE_LABEL[pb.riskGrade]} 등급</span></div>
          <div class="bd">
            <div id="pbs">${pb.items.map(p => `<div class="pb-item" data-pb="${p.playbookId}" data-type="${p.actionType}">
              <div class="h"><b>${esc(p.title)}</b><span class="chip">${esc(ACTION_TYPE[p.actionType] || p.actionType)}</span></div>
              <p>${esc(p.description)}</p>
              <div class="m"><span>예상 비용 ${money(p.estimatedCostUsd)}</span><span>지연 단축 ${p.estimatedDelayReductionDays}일</span></div>
            </div>`).join('')}</div>
            <form id="act-form" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
              <div class="grid2">
                <div class="field" data-field="actionType"><label>조치 유형 <span class="req">*</span></label>
                  <select name="actionType">${Object.entries(ACTION_TYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
                <div class="field" data-field="result"><label>진행 결과</label>
                  <select name="result"><option value="PENDING">대기</option><option value="IN_PROGRESS">진행 중</option><option value="DONE">완료</option><option value="FAILED">실패</option></select></div>
              </div>
              <div class="field" data-field="content"><label>조치 내용 <span class="req">*</span></label>
                <textarea name="content" placeholder="수행했거나 수행할 조치를 구체적으로 입력하세요. (5자 이상)"></textarea>
                <div class="err">조치 내용은 5자 이상 입력해야 합니다.</div></div>
              <div class="field" data-field="resultNote"><label>결과 메모</label><input name="resultNote" placeholder="선사 회신, 증권번호 등"></div>
              <div style="display:flex;gap:8px"><button class="btn primary" type="submit" id="act-sb">조치 등록</button>
                <button class="btn" type="button" id="noti-btn">고객 알림 발송 요청</button></div>
            </form>
          </div></div>

        <div class="card"><div class="hd"><h3>조치 이력</h3><span class="sp"></span><span class="meta">${m.actions.length}건</span></div>
          <div class="bd" id="acts">${renderActions(m.actions)}</div></div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px"><div class="hd"><h3>대상 화물</h3></div><div class="bd">
          <dl class="dl">
            <dt>화물번호</dt><dd class="mono">${esc(m.shipmentNo)}</dd>
            <dt>품목</dt><dd>${esc(m.commodity)}</dd>
            <dt>가액</dt><dd class="mono">${money(m.cargoValueUsd)}</dd>
            <dt>구간</dt><dd>${esc(m.originPort.nameKo)} → ${esc(m.destinationPort.nameKo)}</dd>
            <dt>선박</dt><dd>${esc(m.vesselName || '미배정')}</dd>
            <dt>ETA</dt><dd class="mono">${date(m.eta)}</dd>
            <dt>고객 납기</dt><dd class="mono">${date(m.customerDueDate)}</dd>
            <dt>담당자</dt><dd>${esc(m.ownerName || '-')}</dd>
          </dl>
          <a class="btn sm block" style="margin-top:12px" href="#/shipments/${m.shipmentId}">화물 상세 보기</a>
        </div></div>

        <div class="card" style="margin-bottom:16px"><div class="hd"><h3>리스크 이벤트</h3></div><div class="bd">
          <div style="display:flex;gap:7px;align-items:center;margin-bottom:9px">
            <span>${EVENT_TYPE_ICON[m.eventType] || '•'}</span><span class="chip">${esc(EVENT_TYPE_LABEL[m.eventType] || m.eventType)}</span>
            <span class="chip">심각도 ${m.event.severity}/5</span></div>
          <div style="font-size:14.5px;line-height:1.6;margin-bottom:10px">${esc(m.event.title)}</div>
          <dl class="dl"><dt>영향 기간</dt><dd class="mono">${date(m.event.startDate)} ~ ${date(m.event.expectedEndDate)}</dd>
            <dt>신뢰도</dt><dd class="mono">${pct(m.event.confidence)}</dd>
            <dt>영향 지역</dt><dd>${m.event.areaNames.map(a => `<span class="chip" style="margin:1px 2px 1px 0">${esc(a)}</span>`).join('')}</dd></dl>
          <a class="btn sm block" style="margin-top:12px" href="#/events/${m.eventId}">이벤트 상세 보기</a>
        </div></div>

        <div class="card"><div class="hd"><h3>매칭 피드백 (FR-09)</h3></div><div class="bd">
          ${m.feedback.length ? m.feedback.map(f => `<div class="banner ${f.isRelevant ? 'ok' : 'err'}" style="margin-bottom:8px">
            <span class="ic">${f.isRelevant ? '✓' : '⚑'}</span><div><b>${f.isRelevant ? '실제 영향 확인' : '오탐 신고'}</b>
            ${f.actualDelayDays != null ? ` · 실제 지연 ${f.actualDelayDays}일` : ''}<br>
            <span style="font-size:13px">${esc(f.comment || '')}</span><br>
            <span class="mono muted" style="font-size:12px">${esc(f.userName)} · ${dt(f.createdAt)}</span></div></div>`).join('')
            : `<p class="muted" style="font-size:14px;margin:0 0 12px">이 매칭이 실제로 유효했는지 알려주시면 오탐 관리와 매칭 규칙 개선에 반영됩니다.</p>
            <div style="display:flex;gap:8px"><button class="btn sm" id="fb-yes" style="flex:1">실제 영향 있었음</button>
              <button class="btn sm danger" id="fb-no" style="flex:1">오탐 신고</button></div>`}
        </div></div>
      </div>
    </div>`,
    async mount(page) {
      const form = page.querySelector('#act-form');
      page.querySelectorAll('.pb-item').forEach(el => el.onclick = () => {
        page.querySelectorAll('.pb-item').forEach(x => x.classList.remove('sel'));
        el.classList.add('sel');
        form.actionType.value = el.dataset.type;
        const p = pb.items.find(x => x.playbookId === el.dataset.pb);
        form.content.value = `[${p.title}] ${p.description}`;
        form.content.focus();
      });

      form.onsubmit = async e => {
        e.preventDefault();
        const sb = page.querySelector('#act-sb');
        page.querySelectorAll('.field').forEach(f => f.classList.remove('bad'));
        sb.disabled = true; sb.innerHTML = '<span class="spin"></span>';
        try {
          const sel = page.querySelector('.pb-item.sel');
          await api.post(`/matches/${m.matchId}/actions`, {
            actionType: form.actionType.value, content: form.content.value.trim(),
            result: form.result.value, resultNote: form.resultNote.value.trim() || null,
            playbookId: sel ? sel.dataset.pb : null
          });
          toast('조치가 등록되었습니다. 영향 건 상태가 "조치 완료"로 변경됩니다.', { type:'ok', title:'FR-06 조치 등록' });
          location.hash = `#/matches/${m.matchId}`; location.reload();
        } catch (err) {
          (err.details || []).forEach(d => { const el = page.querySelector(`[data-field="${d.field}"]`); if (el) el.classList.add('bad'); });
          toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` });
        } finally { sb.disabled = false; sb.textContent = '조치 등록'; }
      };

      page.querySelector('#noti-btn').onclick = () => openNotifyModal(m);
      const yes = page.querySelector('#fb-yes'), no = page.querySelector('#fb-no');
      if (yes) yes.onclick = () => openFeedback(m, true);
      if (no) no.onclick = () => openFeedback(m, false);
    }};
}

function renderActions(actions) {
  if (!actions.length) return `<div class="empty" style="padding:34px"><div class="ic">▤</div><h4>등록된 조치가 없습니다</h4>
    <p>위 대응 시나리오를 선택하거나 직접 조치 내용을 입력해 기록하세요.</p></div>`;
  return `<div class="timeline">${actions.map(a => `<div class="tl-item ${a.result === 'DONE' ? 'done' : a.result === 'FAILED' ? 'warn' : 'now'}">
    <div class="d">${dt(a.actedAt)} · ${esc(a.userName || '')}</div>
    <div class="t"><span class="chip">${esc(ACTION_TYPE[a.actionType] || a.actionType)}</span>
      ${chip(ACTION_RESULT, a.result)} ${a.playbookTitle ? `<span class="muted" style="font-size:12.5px">${esc(a.playbookTitle)}</span>` : ''}</div>
    <div class="s">${esc(a.content)}</div>
    ${a.resultNote ? `<div class="s" style="color:var(--ok)">↳ ${esc(a.resultNote)}</div>` : ''}</div>`).join('')}</div>`;
}

function openNotifyModal(m) {
  const md = modal({ title:'알림 발송 요청 (FR-07)', body:`
    <div class="banner info" style="margin-bottom:14px"><span class="ic">ℹ</span><div>
      대외(고객사) 발송 건은 <b>시스템 관리자 승인 후</b> 전송됩니다. 사내 발송은 즉시 전송됩니다.</div></div>
    <form id="nf">
      <div class="grid2">
        <div class="field"><label>발송 범위</label><select name="scope">
          <option value="INTERNAL">사내 (즉시 발송)</option><option value="EXTERNAL">대외 · 고객사 (승인 필요)</option></select></div>
        <div class="field"><label>채널</label><select name="channel">
          <option value="ALIMTALK">알림톡</option><option value="EMAIL">이메일</option><option value="IN_APP">인앱</option></select></div>
      </div>
      <div class="field"><label>제목</label><input name="title" value="[${GRADE_LABEL[m.riskGrade]}] ${esc(m.shipmentNo)} 리스크 알림"></div>
      <div class="field"><label>내용</label><textarea name="message">${esc(m.eventTitle)}(으)로 ${esc(m.shipmentNo)}의 ${esc(m.areaName)} 통과 일정(${date(m.exposureDate)})에 영향이 예상됩니다. 예상 지연 +${m.expectedDelayDays}일, 리스크 점수 ${m.riskScore}점.</textarea></div>
    </form>`,
    actions:[{ label:'취소' }, { label:'발송 요청', cls:'primary', onClick: async (bg, close) => {
      const f = bg.querySelector('#nf');
      try {
        const r = await api.post('/notifications', { matchId:m.matchId, scope:f.scope.value, channel:f.channel.value,
          title:f.title.value, message:f.message.value });
        close();
        toast(r.status === 'PENDING_APPROVAL' ? '대외 발송 건으로 관리자 승인 대기열에 등록되었습니다.' : '알림이 발송되었습니다.',
          { type:'ok', title:`FR-07 · ${r.status}` });
      } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status} · ${err.code}` }); }
    }}]});
  return md;
}

function openFeedback(m, isRelevant) {
  modal({ title: isRelevant ? '실제 영향 확인' : '오탐 신고 (FR-09)', body:`
    <p style="font-size:14.5px;color:var(--fg-2);margin:0 0 14px">
      ${isRelevant ? '이 매칭이 실제 지연·차질로 이어졌다면 실제 지연 일수를 입력해 주세요.'
                   : '이 매칭이 실제로는 영향이 없었던 경우 사유를 남겨 주세요. 매칭 규칙 개선에 사용됩니다.'}</p>
    <form id="ff">
      ${isRelevant ? `<div class="field"><label>실제 지연 일수</label><input name="actualDelayDays" type="number" min="0" value="${m.expectedDelayDays}"></div>` : ''}
      <div class="field"><label>의견</label><textarea name="comment" placeholder="${isRelevant ? '실제 발생한 상황을 적어 주세요.' : '예: 사전 예약 슬롯 보유로 실제 대기 없이 통과'}"></textarea></div>
    </form>`,
    actions:[{ label:'취소' }, { label:'제출', cls: isRelevant ? 'primary' : 'danger', onClick: async (bg, close) => {
      const f = bg.querySelector('#ff');
      try {
        await api.post(`/matches/${m.matchId}/feedback`, { isRelevant,
          actualDelayDays: isRelevant ? Number(f.actualDelayDays.value) : 0, comment: f.comment.value.trim() || null });
        close(); toast('피드백이 등록되었습니다.', { type:'ok' }); location.reload();
      } catch (err) { toast(err.message, { type:'err', title:`오류 ${err.status}` }); }
    }}]});
}

/* ═══════════ 리스크 이벤트 목록 / 상세 ═══════════ */
export async function eventList() {
  return { title:'리스크 이벤트', crumb:'FR-01 수집 / FR-02 정형화 결과',
    html:`<div class="toolbar">
      <div class="seg" id="f-seg"><button data-only="" class="on">전체 이벤트</button><button data-only="true">내 화물 영향</button></div>
      <select id="type" style="min-width:150px"><option value="">전체 유형</option>
        ${Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input id="kw" placeholder="제목·내용 검색" style="min-width:190px">
      </div><div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { onlyImpacted:'', eventType:'', keyword:'' };
      page.querySelectorAll('#f-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#f-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.onlyImpacted = b.dataset.only; load(); });
      page.querySelector('#type').onchange = e => { st.eventType = e.target.value; load(); };
      let t; page.querySelector('#kw').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.keyword = e.target.value; load(); }, 280); };
      async function load() {
        const box = page.querySelector('#list');
        const r = await api.get('/risk-events', st);
        if (!r.items.length) { box.innerHTML = `<div class="card"><div class="bd"><div class="empty"><div class="ic">⚡</div>
          <h4>표시할 이벤트가 없습니다</h4><p>조건을 변경해 보세요.</p></div></div></div>`; return; }
        box.innerHTML = `<div class="cols3">${r.items.map(e => `
          <a class="card" href="#/events/${e.eventId}" style="display:block;transition:.13s">
            <div class="hd"><span style="font-size:17px">${EVENT_TYPE_ICON[e.eventType] || '•'}</span>
              <h3>${esc(EVENT_TYPE_LABEL[e.eventType] || e.eventType)}</h3><span class="sp"></span>
              ${e.myImpactedCount ? `<span class="badge g-${e.topRiskGrade}"><i></i>${e.myImpactedCount}건</span>` : '<span class="chip">영향 없음</span>'}</div>
            <div class="bd">
              <div style="font-size:15px;line-height:1.5;margin-bottom:10px;min-height:39px">${esc(e.title)}</div>
              <div style="font-size:13px;color:var(--fg-3);line-height:1.6;margin-bottom:12px;
                display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(e.summary)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
                ${e.areaNames.slice(0, 4).map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;font-family:var(--mono);color:var(--fg-3);
                border-top:1px solid var(--line);padding-top:9px">
                <span>심각도 ${e.severity}/5 · 신뢰도 ${pct(e.confidence)}</span><span>${date(e.startDate)}~${date(e.expectedEndDate)}</span></div>
            </div></a>`).join('')}</div>`;
      }
      await load();
    }};
}

export async function eventDetail({ params }) {
  const e = await api.get(`/risk-events/${params[0]}`);
  return { title:'리스크 이벤트 상세', crumb:`${e.eventId} · ${EVENT_TYPE_LABEL[e.eventType] || e.eventType}`,
    html:`<div style="margin-bottom:14px"><a class="btn sm ghost" href="#/events">← 이벤트 목록</a></div>
    <div class="cols"><div>
      <div class="card" style="margin-bottom:16px"><div class="hd">
        <span style="font-size:18.5px">${EVENT_TYPE_ICON[e.eventType] || '•'}</span>
        <h3>${esc(EVENT_TYPE_LABEL[e.eventType] || e.eventType)}</h3><span class="sp"></span>
        <span class="chip">심각도 ${e.severity}/5</span><span class="chip">신뢰도 ${pct(e.confidence)}</span></div>
        <div class="bd">
          <h2 style="font-size:19.5px;margin:0 0 10px;line-height:1.45">${esc(e.title)}</h2>
          <p style="font-size:15px;color:var(--fg-2);line-height:1.75;margin:0 0 16px">${esc(e.summary)}</p>
          <dl class="dl"><dt>영향 기간</dt><dd class="mono">${date(e.startDate)} ~ ${date(e.expectedEndDate)}</dd>
            <dt>정형화</dt><dd class="mono">${esc(e.llmModel)} · ${dt(e.llmExtractedAt)}</dd>
            <dt>검토</dt><dd>${esc(e.reviewerName || '-')} · ${dt(e.reviewedAt)}</dd>
            ${e.reviewNote ? `<dt>검토 메모</dt><dd class="muted">${esc(e.reviewNote)}</dd>` : ''}</dl>
        </div></div>

      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>영향 지역 (FR-02)</h3><span class="sp"></span>
        <span class="meta">${e.areas.length}개 지역</span></div><div class="bd flush">
        <table><thead><tr><th style="width:115px">구분</th><th>지역</th><th style="width:115px">영향도</th>
          <th style="width:127px">예상 지연</th><th style="width:115px">내 화물</th></tr></thead><tbody>
          ${e.areas.map(a => { const cnt = e.matches.filter(m => m.areaName === a.areaName).length;
            return `<tr><td>${a.areaType === 'PORT' ? '<span class="chip">항만</span>' : '<span class="chip info">해상 요충지</span>'}</td>
            <td>${esc(a.areaName)} <span class="muted mono" style="font-size:12.5px">${esc((a.port && a.port.unlocode) || (a.chokePoint && a.chokePoint.code) || '')}</span></td>
            <td><span class="mono">${a.impactLevel}/5</span></td><td class="mono">+${a.expectedDelayDays}일</td>
            <td>${cnt ? `<span class="badge g-HIGH"><i></i>${cnt}건</span>` : '<span class="muted">-</span>'}</td></tr>`; }).join('')}
        </tbody></table></div></div>

      <div class="card"><div class="hd"><h3>내 화물 영향 건 (FR-03)</h3><span class="sp"></span>
        <span class="meta">${e.matches.length}건</span></div><div class="bd flush">
        ${e.matches.length ? `<table><thead><tr><th style="width:79px">점수</th><th>화물</th>
          <th style="width:168px">매칭 근거</th><th style="width:115px">노출일</th><th style="width:106px">상태</th></tr></thead><tbody>
          ${e.matches.map(m => `<tr class="clickable" data-id="${m.matchId}">
            <td class="mono" style="font-size:17px;font-weight:600;color:${riskColor(m.riskScore)}">${m.riskScore}</td>
            <td><div class="mono" style="font-size:13px">${esc(m.shipmentNo)}</div>
              <div class="muted" style="font-size:12.5px">${esc(m.commodity)} · ${esc(m.vesselName || '-')}</div></td>
            <td><div>${esc(m.areaName)}</div><div class="muted" style="font-size:12.5px">${esc(MATCH_REASON_LABEL[m.matchReason] || '')}</div></td>
            <td class="mono">${date(m.exposureDate)}</td><td>${grade(m.riskGrade)}</td></tr>`).join('')}</tbody></table>`
          : `<div class="empty"><div class="ic">✓</div><h4>영향받는 화물이 없습니다</h4>
             <p>이 이벤트의 영향 지역·기간과 겹치는 운송 건이 없습니다.</p></div>`}
      </div></div>
    </div>
    <div>
      <div class="card"><div class="hd"><h3>수집 원문 (FR-01)</h3></div><div class="bd">
        ${e.source ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px">
            <span class="chip info">${esc(e.source.sourceName)}</span>
            <span class="chip">${esc(e.source.sourceType)}</span>
            <span class="chip">신뢰가중치 ${e.source.trustWeight}</span></div>
          <div style="font-size:14.5px;font-weight:600;line-height:1.5;margin-bottom:9px">${esc(e.source.title)}</div>
          <div style="font-size:13px;color:var(--fg-3);line-height:1.75;max-height:280px;overflow:auto;
            background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:11px">${esc(e.source.body)}</div>
          <dl class="dl" style="margin-top:12px"><dt>발행</dt><dd class="mono">${dt(e.source.publishedAt)}</dd>
            <dt>수집</dt><dd class="mono">${dt(e.source.collectedAt)}</dd>
            <dt>원문</dt><dd><a href="${esc(e.source.url)}" target="_blank" style="color:var(--accent);word-break:break-all;font-size:12.5px">${esc(e.source.url)}</a></dd></dl>`
          : '<div class="muted">원문 정보가 없습니다.</div>'}
      </div></div>
    </div></div>`,
    mount(page) { page.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/matches/${tr.dataset.id}`); }};
}

/* ═══════════ 내 화물 목록 ═══════════ */
export async function shipmentList({ user }) {
  return { title:'내 화물', crumb:`${user.companyName} · 등록 화물 관리`,
    html:`<div class="toolbar">
        <div class="seg" id="sc-seg"><button data-sc="" class="on">회사 전체</button><button data-sc="mine">내가 등록한 건</button></div>
        <select id="status" style="min-width:150px"><option value="">전체 상태</option>
          ${Object.entries(SHIPMENT_STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
        <select id="grade" style="min-width:132px"><option value="">전체 리스크</option>
          ${GRADES.map(g => `<option value="${g}">${GRADE_LABEL[g]}</option>`).join('')}</select>
        <input id="kw" placeholder="화물번호·품목·고객사 검색" style="min-width:200px">
        <div class="sp"></div><a class="btn primary" href="#/shipments/new">＋ 화물 등록</a>
      </div>
      <div class="card"><div class="bd flush"><div id="list"><div class="loading"><span class="spin"></span></div></div></div></div>`,
    async mount(page) {
      const st = { scope:'', status:'', grade:'', keyword:'', sort:'risk' };
      page.querySelectorAll('#sc-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#sc-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.scope = b.dataset.sc; load(); });
      page.querySelector('#status').onchange = e => { st.status = e.target.value; load(); };
      page.querySelector('#grade').onchange = e => { st.grade = e.target.value; load(); };
      let t; page.querySelector('#kw').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.keyword = e.target.value; load(); }, 280); };
      async function load() {
        const box = page.querySelector('#list');
        const r = await api.get('/shipments', st);
        if (!r.items.length) { box.innerHTML = `<div class="empty"><div class="ic">▣</div><h4>등록된 화물이 없습니다</h4>
          <p>화물과 항로를 등록하면 진행 중인 리스크 이벤트와 자동으로 매칭되어 지도에 표시됩니다.</p>
          <a class="btn primary" style="margin-top:14px" href="#/shipments/new">첫 화물 등록하기</a></div>`; return; }
        box.innerHTML = `<div class="tbl-wrap"><table><thead><tr>
          <th style="width:151px">화물번호</th><th>품목 / 고객사</th><th style="width:223px">운송 구간</th>
          <th style="width:132px">일정</th><th style="width:127px">가액</th><th style="width:142px">상태</th>
          <th style="width:127px">리스크</th></tr></thead><tbody>
          ${r.items.map(s => `<tr class="clickable" data-id="${s.shipmentId}">
            <td><div class="mono" style="font-size:13px">${esc(s.shipmentNo)}</div>
              <div class="muted" style="font-size:12px">${esc(s.ownerName || '')}</div></td>
            <td><div>${esc(s.commodity)}</div><div class="muted" style="font-size:12.5px">${esc(s.customerName || '-')}</div></td>
            <td><div>${esc(s.originPort.nameKo)} → ${esc(s.destinationPort.nameKo)}</div>
              <div class="muted" style="font-size:12.5px">${esc(s.vessel ? s.vessel.vesselName : '선박 미배정')}</div></td>
            <td class="mono" style="font-size:12.5px">${date(s.etd)}<br><span class="muted">${date(s.eta)}</span></td>
            <td class="mono">${money(s.cargoValueUsd)}</td>
            <td>${chip(SHIPMENT_STATUS, s.status)}</td>
            <td>${s.topRiskGrade === 'NONE' ? '<span class="chip ok">영향 없음</span>'
              : `<div style="display:flex;align-items:center;gap:6px">
                 <span class="mono" style="font-size:17px;font-weight:600;color:${riskColor(s.topRiskScore)}">${s.topRiskScore}</span>
                 ${grade(s.topRiskGrade)}</div><div class="muted" style="font-size:12px;margin-top:2px">${s.matchCount || 0}건 매칭</div>`}</td>
          </tr>`).join('')}</tbody></table></div>
          <div style="padding:15px 18px;border-top:1px solid var(--line);font-size:13px;color:var(--fg-3)" class="mono">총 ${r.total}건</div>`;
        box.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/shipments/${tr.dataset.id}`);
      }
      await load();
    }};
}

/* ═══════════ 화물 등록 (3단계) ═══════════ */
export async function shipmentNew() {
  const [ports, voyages] = await Promise.all([ api.get('/ports'), api.get('/voyages') ]);
  const opt = sel => ports.items.map(p => `<option value="${p.portId}" ${p.portId === sel ? 'selected' : ''}>${esc(p.nameKo)} (${p.unlocode})</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);
  return { title:'화물 등록', crumb:'등록 → 경유 요충지 산출 → 관리자 승인',
    html:`<div style="max-width:940px">
      <div class="steps">
        <div class="step on" data-step="1"><span class="n">1</span>화물 정보</div><div class="step-line"></div>
        <div class="step" data-step="2"><span class="n">2</span>항로 · 일정</div><div class="step-line"></div>
        <div class="step" data-step="3"><span class="n">3</span>납기 · 확인</div>
      </div>
      <form id="f" novalidate>
        <div class="card sc" data-pane="1"><div class="hd"><h3>1. 화물 기본 정보</h3></div><div class="bd">
          <div class="grid2">
            <div class="field" data-field="commodity"><label>품목명 <span class="req">*</span></label>
              <input name="commodity" placeholder="예: 반도체 포토레지스트"><div class="err">품목명을 입력하세요.</div></div>
            <div class="field" data-field="customerName"><label>고객사 / 수하인</label><input name="customerName" placeholder="예: ASML Netherlands B.V."></div>
          </div>
          <div class="grid3">
            <div class="field" data-field="cargoValueUsd"><label>화물 가액 (USD) <span class="req">*</span></label>
              <input name="cargoValueUsd" type="number" min="1" placeholder="1450000"><div class="err">가액은 0보다 커야 합니다.</div>
              <div class="hint">리스크 점수의 노출도(가액) 계산에 사용됩니다.</div></div>
            <div class="field" data-field="incoterms"><label>인코텀즈</label>
              <select name="incoterms"><option>FOB</option><option>CIF</option><option>DAP</option><option>EXW</option><option>FCA</option><option>DDP</option></select></div>
            <div class="field" data-field="weightKg"><label>총 중량 (kg)</label><input name="weightKg" type="number" min="0" placeholder="42000"></div>
          </div>
          <div class="grid3">
            <div class="field" data-field="containerType"><label>컨테이너 타입</label>
              <select name="containerType"><option>40HC</option><option>20GP</option><option>40GP</option><option>20RF</option><option>40RF</option><option>40OT</option><option>40FR</option><option>20TK</option></select></div>
            <div class="field" data-field="containerCount"><label>컨테이너 수량</label><input name="containerCount" type="number" min="1" value="1"></div>
            <div class="field" data-field="containerNo"><label>컨테이너 번호</label><input name="containerNo" placeholder="HDMU4182736"></div>
          </div>
          <div style="display:flex;justify-content:flex-end"><button class="btn primary" type="button" data-next="2">다음: 항로 입력 →</button></div>
        </div></div>

        <div class="card sc" data-pane="2" style="display:none"><div class="hd"><h3>2. 항로 및 일정</h3></div><div class="bd">
          <div class="grid2">
            <div class="field" data-field="originPortId"><label>출발항 <span class="req">*</span></label><select name="originPortId">${opt('P001')}</select></div>
            <div class="field" data-field="destinationPortId"><label>도착항 <span class="req">*</span></label><select name="destinationPortId">${opt('P017')}</select>
              <div class="err">출발항과 도착항이 동일합니다.</div></div>
          </div>
          <div class="grid2">
            <div class="field" data-field="etd"><label>출항 예정일 (ETD) <span class="req">*</span></label><input name="etd" type="date" value="${today}"><div class="err">출항 예정일을 확인하세요.</div></div>
            <div class="field" data-field="voyageId"><label>선박 / 항차 (선택)</label>
              <select name="voyageId"><option value="">미배정 — 나중에 지정</option>
                ${voyages.items.map(v => `<option value="${v.voyageId}">${esc(v.vesselName)} · ${esc(v.voyageNo)} (${esc(v.serviceRouteName)})</option>`).join('')}</select>
              <div class="hint">배정하면 해당 선박의 현재 위치가 리스크 레이더 지도에 표시됩니다.</div></div>
          </div>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" name="preferCapeRoute">
            <span><b>희망봉 우회 항로 적용</b><br><span class="muted" style="font-size:13px">수에즈·홍해 대신 아프리카 남단으로 우회합니다. 항해일수는 늘지만 홍해 리스크에서 제외됩니다.</span></span></label>
          <button class="btn" type="button" id="calc">경유 요충지 · 도착 예정일 자동 산출</button>
          <div id="plan" style="margin-top:14px"></div>
          <div style="display:flex;justify-content:space-between;margin-top:16px">
            <button class="btn ghost" type="button" data-next="1">← 이전</button>
            <button class="btn primary" type="button" data-next="3">다음: 납기 확인 →</button></div>
        </div></div>

        <div class="card sc" data-pane="3" style="display:none"><div class="hd"><h3>3. 납기 및 대체경로</h3></div><div class="bd">
          <div class="grid2">
            <div class="field" data-field="eta"><label>도착 예정일 (ETA) <span class="req">*</span></label><input name="eta" type="date"><div class="err">ETA는 ETD보다 빠를 수 없습니다.</div></div>
            <div class="field" data-field="customerDueDate"><label>고객 납기일 <span class="req">*</span></label><input name="customerDueDate" type="date">
              <div class="err">고객 납기일이 도착 예정일보다 빠릅니다.</div>
              <div class="hint">ETA와의 차이(납기 여유)가 리스크 점수의 긴급도에 반영됩니다.</div></div>
          </div>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" name="alternativeRouteAvailable">
            <span><b>대체 경로 확보 가능</b><br><span class="muted" style="font-size:13px">우회 항로·대체 선복·항공 전환이 가능한 건입니다. 체크 시 경로 경직성이 1.00 → 0.35로 낮아져 리스크 점수가 감소합니다.</span></span></label>
          <div class="field" data-field="memo"><label>메모</label><textarea name="memo" placeholder="특이사항"></textarea></div>
          <div id="preview"></div>
          <div class="banner info" style="margin-top:14px"><span class="ic">ℹ</span><div>
            등록 즉시 진행 중인 리스크 이벤트와 매칭되어 <b>잠정 결과</b>가 지도에 표시되며,
            <b>시스템 관리자 승인 후</b> 정식 모니터링·알림 대상이 됩니다.</div></div>
          <div style="display:flex;justify-content:space-between;margin-top:16px">
            <button class="btn ghost" type="button" data-next="2">← 이전</button>
            <button class="btn primary" type="submit" id="sb">화물 등록 신청</button></div>
        </div></div>
      </form></div>`,
    async mount(page) {
      const f = page.querySelector('#f');
      const show = n => {
        page.querySelectorAll('.sc').forEach(p => p.style.display = p.dataset.pane === String(n) ? '' : 'none');
        page.querySelectorAll('.step').forEach(s => {
          s.classList.toggle('on', s.dataset.step === String(n));
          s.classList.toggle('ok', Number(s.dataset.step) < n);
        });
        window.scrollTo({ top:0, behavior:'smooth' });
      };
      page.querySelectorAll('[data-next]').forEach(b => b.onclick = () => {
        if (b.dataset.next === '2' && !f.commodity.value.trim()) {
          page.querySelector('[data-field="commodity"]').classList.add('bad'); return;
        }
        if (b.dataset.next === '3' && !f.eta.value) calc();
        show(Number(b.dataset.next));
      });

      async function calc() {
        const box = page.querySelector('#plan');
        if (f.originPortId.value === f.destinationPortId.value) {
          page.querySelector('[data-field="destinationPortId"]').classList.add('bad');
          box.innerHTML = `<div class="banner err"><span class="ic">⛔</span><div>출발항과 도착항이 동일합니다.</div></div>`; return;
        }
        page.querySelector('[data-field="destinationPortId"]').classList.remove('bad');
        box.innerHTML = `<div class="loading" style="padding:26px"><span class="spin"></span></div>`;
        try {
          const p = await api.post('/routes/preview', { originPortId:f.originPortId.value,
            destinationPortId:f.destinationPortId.value, etd:f.etd.value, preferCapeRoute:f.preferCapeRoute.checked });
          f.eta.value = p.eta;
          if (!f.customerDueDate.value) {
            const d = new Date(p.eta + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7);
            f.customerDueDate.value = d.toISOString().slice(0, 10);
          }
          box.innerHTML = `<div class="banner ok"><span class="ic">✓</span><div>
            <b>${esc(p.originPort.nameKo)} → ${esc(p.destinationPort.nameKo)}</b> · 약 ${p.transitDays}일 · ${num(p.distanceNm)} NM
            (평균 ${p.assumedSpeedKn}kn 가정) · 도착 예정 <b>${date(p.eta)}</b></div></div>
            ${p.routePoints.length ? `<div class="card"><div class="hd"><h3>통과 예정 해상 요충지</h3><span class="sp"></span>
              <span class="meta">FR-03 매칭 기준 데이터</span></div><div class="bd flush">
              <table><thead><tr><th style="width:60px">순번</th><th>요충지</th><th style="width:156px">통과 예정일</th></tr></thead><tbody>
              ${p.routePoints.map(r => `<tr><td class="mono">${r.seq}</td><td>${esc(r.nameKo)}
                <span class="muted mono" style="font-size:12.5px">${esc(r.code)}</span></td>
                <td class="mono">${date(r.expectedPassageDate)}</td></tr>`).join('')}</tbody></table></div></div>`
              : `<div class="banner info"><span class="ic">ℹ</span><div>이 구간은 통과하는 주요 해상 요충지가 없습니다. 항만 단위 리스크만 매칭됩니다.</div></div>`}`;
          renderPreview();
        } catch (err) {
          box.innerHTML = `<div class="banner err"><span class="ic">⛔</span><div>${esc(err.message)}
            <span class="mono muted" style="display:block">HTTP ${err.status} · ${esc(err.code)}</span></div></div>`;
        }
      }
      page.querySelector('#calc').onclick = calc;

      function renderPreview() {
        const buf = f.eta.value && f.customerDueDate.value
          ? Math.round((new Date(f.customerDueDate.value) - new Date(f.eta.value)) / 86400000) : null;
        page.querySelector('#preview').innerHTML = buf == null ? '' : `
          <div class="banner ${buf <= 3 ? 'warn' : 'ok'}"><span class="ic">${buf <= 3 ? '⚠' : '✓'}</span><div>
            납기 여유 <b>${buf}일</b> — ${buf <= 3 ? '여유가 매우 짧아 리스크 점수의 긴급도가 최대치에 가깝게 반영됩니다.'
              : buf <= 10 ? '보통 수준의 긴급도로 반영됩니다.' : '여유가 충분해 긴급도 기여가 낮습니다.'}</div></div>`;
      }
      f.eta.onchange = renderPreview; f.customerDueDate.onchange = renderPreview;

      f.onsubmit = async e => {
        e.preventDefault();
        const sb = page.querySelector('#sb');
        page.querySelectorAll('.field').forEach(x => x.classList.remove('bad'));
        sb.disabled = true; sb.innerHTML = '<span class="spin"></span> 등록 중…';
        try {
          const s = await api.post('/shipments', {
            commodity:f.commodity.value.trim(), customerName:f.customerName.value.trim() || null,
            cargoValueUsd:Number(f.cargoValueUsd.value), incoterms:f.incoterms.value,
            weightKg:Number(f.weightKg.value || 0), containerType:f.containerType.value,
            containerCount:Number(f.containerCount.value || 1), containerNo:f.containerNo.value.trim() || null,
            originPortId:f.originPortId.value, destinationPortId:f.destinationPortId.value,
            voyageId:f.voyageId.value || null, etd:f.etd.value, eta:f.eta.value,
            customerDueDate:f.customerDueDate.value, preferCapeRoute:f.preferCapeRoute.checked,
            alternativeRouteAvailable:f.alternativeRouteAvailable.checked, memo:f.memo.value.trim() || null
          });
          const top = s.matches[0];
          modal({ title:'화물 등록 신청 완료', body:`
            <div class="banner ok"><span class="ic">✓</span><div><b>${esc(s.shipmentNo)}</b> 등록이 신청되었습니다.<br>
              관리자 승인 후 정식 모니터링 대상이 됩니다.</div></div>
            ${top ? `<div class="banner warn" style="margin-top:12px"><span class="ic">⚠</span><div>
              등록 즉시 <b>${s.matches.length}건</b>의 리스크 이벤트와 매칭되었습니다.<br>
              최고 리스크: <b style="color:${riskColor(top.riskScore)}">${top.riskScore}점 (${GRADE_LABEL[top.riskGrade]})</b> —
              ${esc(top.eventTitle)}</div></div>`
             : `<div class="banner info" style="margin-top:12px"><span class="ic">ℹ</span><div>
              현재 진행 중인 리스크 이벤트와 겹치는 구간·일정이 없습니다.</div></div>`}`,
            actions:[{ label:'화물 목록', onClick:(bg, c) => { c(); location.hash = '#/shipments'; } },
              { label:'리스크 레이더에서 보기', cls:'primary', onClick:(bg, c) => { c(); location.hash = '#/radar'; } }] });
        } catch (err) {
          (err.details || []).forEach(d => { const el = page.querySelector(`[data-field="${d.field}"]`); if (el) el.classList.add('bad'); });
          toast(err.message, { type:'err', title:`등록 실패 · HTTP ${err.status}` });
          if ((err.details || []).some(d => ['eta', 'customerDueDate'].includes(d.field))) show(3);
        } finally { sb.disabled = false; sb.textContent = '화물 등록 신청'; }
      };
    }};
}

/* ═══════════ 화물 상세 ═══════════ */
export async function shipmentDetail({ params }) {
  const s = await api.get(`/shipments/${params[0]}`);
  const buf = s.customerDueDate && s.eta ? Math.round((new Date(s.customerDueDate) - new Date(s.eta)) / 86400000) : null;
  return { title:`화물 ${s.shipmentNo}`, crumb:`${esc(s.companyName)} · ${esc(s.commodity)}`,
    html:`<div style="margin-bottom:14px"><a class="btn sm ghost" href="#/shipments">← 화물 목록</a></div>
    ${s.status === 'REJECTED' ? `<div class="banner err"><span class="ic">⛔</span><div><b>등록이 반려되었습니다.</b><br>
      ${esc(s.rejectReason || '')}<br><span style="font-size:13px">내용을 수정하면 다시 승인 대기 상태로 전환됩니다.</span></div></div>` : ''}
    ${s.status === 'PENDING_APPROVAL' ? `<div class="banner warn"><span class="ic">⏳</span><div>
      <b>관리자 승인 대기 중입니다.</b> 아래 리스크 분석은 잠정 결과이며, 승인 후 알림 발송 대상이 됩니다.</div></div>` : ''}
    <div class="cols"><div>
      <div class="kpis">
        <div class="kpi ${s.topRiskGrade === 'CRITICAL' ? 'crit' : s.topRiskGrade === 'HIGH' ? 'high' : s.topRiskGrade === 'MEDIUM' ? 'med' : 'low'}">
          <div class="lb">최고 리스크 점수</div><div class="vl" style="color:${riskColor(s.topRiskScore)}">${s.topRiskScore}</div>
          <div class="sx">${GRADE_LABEL[s.topRiskGrade] || '영향 없음'}</div></div>
        <div class="kpi"><div class="lb">매칭된 이벤트</div><div class="vl">${s.matches.length}</div><div class="sx">미조치 ${s.openMatchCount}건</div></div>
        <div class="kpi"><div class="lb">최대 예상 지연</div><div class="vl">${s.maxExpectedDelayDays}<span style="font-size:16px">일</span></div><div class="sx">누적 아님, 최대값</div></div>
        <div class="kpi ${buf != null && buf <= 3 ? 'crit' : ''}"><div class="lb">납기 여유</div>
          <div class="vl">${buf == null ? '-' : buf}<span style="font-size:16px">일</span></div><div class="sx">ETA 대비 고객 납기</div></div>
      </div>

      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>영향 건 (FR-03 매칭 결과)</h3><span class="sp"></span>
        <span class="meta">${s.matches.length}건</span></div><div class="bd flush">
        ${s.matches.length ? `<table><thead><tr><th style="width:79px">점수</th><th>리스크 이벤트</th>
          <th style="width:180px">매칭 근거</th><th style="width:115px">노출일</th><th style="width:115px">상태</th></tr></thead><tbody>
          ${s.matches.map(m => `<tr class="clickable" data-id="${m.matchId}">
            <td class="mono" style="font-size:17px;font-weight:600;color:${riskColor(m.riskScore)}">${m.riskScore}</td>
            <td><div style="display:flex;gap:6px;align-items:center">${EVENT_TYPE_ICON[m.eventType] || '•'}<span>${esc(m.eventTitle)}</span></div></td>
            <td><div>${esc(m.areaName)}</div><div class="muted" style="font-size:12.5px">${esc(MATCH_REASON_LABEL[m.matchReason] || '')}</div></td>
            <td class="mono">${date(m.exposureDate)}</td>
            <td>${grade(m.riskGrade)}<div style="margin-top:3px">${chip(MATCH_STATUS, m.status)}</div></td></tr>`).join('')}
          </tbody></table>` : `<div class="empty"><div class="ic">✓</div><h4>현재 노출된 리스크가 없습니다</h4>
          <p>이 화물의 운송 구간·일정과 겹치는 진행 중 리스크 이벤트가 없습니다.</p></div>`}
      </div></div>

      <div class="card"><div class="hd"><h3>운송 일정</h3><span class="sp"></span>
        <span class="meta">${esc(s.vessel ? s.vessel.vesselName + ' · ' + s.vessel.voyageNo : '선박 미배정')}</span></div>
        <div class="bd"><div class="timeline">
          ${buildSchedule(s).map(x => `<div class="tl-item ${x.cls}">
            <div class="d">${date(x.date)}</div><div class="t">${esc(x.title)}</div>
            <div class="s">${esc(x.sub)}</div></div>`).join('')}
        </div></div></div>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>화물 정보</h3><span class="sp"></span>${chip(SHIPMENT_STATUS, s.status)}</div>
        <div class="bd"><dl class="dl">
          <dt>화물번호</dt><dd class="mono">${esc(s.shipmentNo)}</dd>
          <dt>품목</dt><dd>${esc(s.commodity)}</dd>
          <dt>고객사</dt><dd>${esc(s.customerName || '-')}</dd>
          <dt>가액</dt><dd class="mono">${money(s.cargoValueUsd)}</dd>
          <dt>인코텀즈</dt><dd>${esc(s.incoterms)}</dd>
          <dt>컨테이너</dt><dd>${esc(s.containerType)} × ${s.containerCount} ${s.containerNo ? `<br><span class="mono muted" style="font-size:12.5px">${esc(s.containerNo)}</span>` : ''}</dd>
          <dt>중량</dt><dd class="mono">${num(s.weightKg)} kg</dd>
          <dt>대체 경로</dt><dd>${s.alternativeRouteAvailable ? '<span class="chip ok">확보 가능</span>' : '<span class="chip warn">없음</span>'}</dd>
          <dt>담당자</dt><dd>${esc(s.ownerName || '-')}</dd>
          <dt>등록일</dt><dd class="mono">${dt(s.createdAt)}</dd>
          ${s.approvedAt ? `<dt>승인</dt><dd class="mono">${dt(s.approvedAt)} · ${esc(s.approverName || '')}</dd>` : ''}
        </dl></div></div>

      <div class="card"><div class="hd"><h3>통과 예정 해상 요충지</h3></div><div class="bd">
        ${s.routePoints.length ? `<div class="timeline">${s.routePoints.map(r => `<div class="tl-item">
          <div class="d">${date(r.expectedPassageDate)}</div>
          <div class="t">${esc(r.chokePoint ? r.chokePoint.nameKo : '-')}</div>
          <div class="s mono">${esc(r.chokePoint ? r.chokePoint.code : '')}</div></div>`).join('')}</div>`
          : '<div class="muted" style="font-size:14px">통과하는 주요 해상 요충지가 없습니다.</div>'}
      </div></div>
    </div></div>`,
    mount(page) { page.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = `#/matches/${tr.dataset.id}`); }};
}

function buildSchedule(s) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  rows.push({ date:s.etd, title:`${s.originPort.nameKo} 출항`, sub:'ETD', cls:s.etd <= today ? 'done' : '' });
  (s.schedule || []).slice(1, -1).forEach(l => rows.push({ date:l.eta || l.etd, title:`${l.port.nameKo} 기항`, sub:'중간 기항지', cls:(l.eta || l.etd) <= today ? 'done' : '' }));
  (s.routePoints || []).forEach(r => rows.push({ date:r.expectedPassageDate,
    title:`${r.chokePoint ? r.chokePoint.nameKo : ''} 통과`, sub:'해상 요충지', cls:r.expectedPassageDate <= today ? 'done' : 'warn' }));
  rows.push({ date:s.eta, title:`${s.destinationPort.nameKo} 도착`, sub:'ETA', cls:'' });
  if (s.customerDueDate) rows.push({ date:s.customerDueDate, title:'고객 납기일', sub:'Due date', cls:'now' });
  return rows.filter(r => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* ═══════════ 알림 센터 (FR-07) ═══════════ */
export async function notifications() {
  return { title:'알림 센터', crumb:'FR-07 알림 발송 이력',
    html:`<div class="toolbar"><div class="seg" id="f-seg">
        <button data-s="" class="on">전체</button><button data-s="SENT">발송 완료</button>
        <button data-s="PENDING_APPROVAL">승인 대기</button><button data-s="FAILED,REJECTED">실패·반려</button></div></div>
      <div id="list"><div class="loading"><span class="spin"></span></div></div>`,
    async mount(page) {
      const st = { status:'' };
      page.querySelectorAll('#f-seg button').forEach(b => b.onclick = () => {
        page.querySelectorAll('#f-seg button').forEach(x => x.classList.remove('on')); b.classList.add('on');
        st.status = b.dataset.s; load(); });
      async function load() {
        const box = page.querySelector('#list');
        const r = await api.get('/notifications', st);
        if (!r.items.length) { box.innerHTML = `<div class="card"><div class="bd"><div class="empty"><div class="ic">✉</div>
          <h4>알림이 없습니다</h4><p>리스크 점수가 임계값을 초과하면 자동으로 알림이 발송됩니다.</p></div></div></div>`; return; }
        box.innerHTML = `<div class="card"><div class="bd flush"><table><thead><tr>
          <th style="width:120px">채널·범위</th><th>내용</th><th style="width:144px">관련 화물</th>
          <th style="width:151px">일시</th><th style="width:132px">상태</th></tr></thead><tbody>
          ${r.items.map(n => `<tr ${n.matchId ? `class="clickable" data-id="${n.matchId}"` : ''} data-noti="${n.notificationId}"
            style="${!n.readAt && n.status === 'SENT' ? 'background:rgba(34,211,238,.04)' : ''}">
            <td><div class="chip">${esc(CHANNEL_LABEL[n.channel] || n.channel)}</div>
              <div style="margin-top:3px">${n.scope === 'EXTERNAL' ? '<span class="chip warn">대외</span>' : '<span class="chip">사내</span>'}</div></td>
            <td><div style="font-weight:${!n.readAt && n.status === 'SENT' ? '600' : '400'}">${esc(n.title)}</div>
              <div class="muted" style="font-size:13px;margin-top:2px">${esc(n.message)}</div>
              ${n.failReason ? `<div style="color:var(--err);font-size:12.5px;margin-top:3px">↳ ${esc(n.failReason)}</div>` : ''}</td>
            <td class="mono" style="font-size:12.5px">${esc(n.shipmentNo || '-')}</td>
            <td class="mono" style="font-size:12.5px">${dt(n.sentAt || n.createdAt)}</td>
            <td>${chip(NOTI_STATUS, n.status)}</td></tr>`).join('')}
        </tbody></table></div></div>`;
        box.querySelectorAll('tr[data-noti]').forEach(tr => tr.onclick = async () => {
          try { await api.patch(`/notifications/${tr.dataset.noti}/read`); } catch {}
          if (tr.dataset.id) location.hash = `#/matches/${tr.dataset.id}`; else load();
        });
      }
      await load();
    }};
}
