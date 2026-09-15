// SONAR - 리스크 레이더 지도 (Leaflet, 실패 시 SVG 폴백)
import { riskColor, esc, GRADE_LABEL, EVENT_TYPE_LABEL, date } from './ui.js';

// 키가 필요 없는 다크 베이스맵. 1순위 실패 시 OSM 표준 타일을 CSS 필터로 어둡게 렌더링한다.
// 외부 타일 서버에 의존하지 않는 내장 벡터 베이스맵.
// Natural Earth 110m 국경 데이터를 Leaflet 이 직접 그린다 (오프라인 동작).
const WORLD_GEOJSON = new URL('../data/world.geo.json', import.meta.url).href;
const ATTR = 'Natural Earth';
const LAND_STYLE   = { fillColor:'#16202c', fillOpacity:1, color:'#243546', weight:.7, interactive:false };
let worldCache = null;
async function loadWorld() {
  if (!worldCache) worldCache = fetch(WORLD_GEOJSON).then(r => r.json());
  return worldCache;
}

function vesselIcon(v, selected) {
  const c = v.topRiskScore ? riskColor(v.topRiskScore) : '#ffffff';
  const cls = ['vessel-icon', selected ? 'sel' : '', v.provisional ? 'prov' : ''].filter(Boolean).join(' ');
  const pulse = v.topRiskGrade === 'CRITICAL' ? `<span class="pulse" style="background:${c}"></span>` : '';
  return L.divIcon({ className:'', iconSize:[20,20], iconAnchor:[10,10],
    html:`<div class="${cls}" style="position:relative;width:20px;height:20px">${pulse}<span class="hull" style="background:${c}"></span></div>` });
}

function popupHtml(v) {
  return `<div style="min-width:220px">
    <div style="font-weight:600;font-size:15px;margin-bottom:2px">${esc(v.vesselName || '-')}</div>
    <div style="font-family:var(--mono);font-size:12px;color:var(--fg-3);margin-bottom:9px">
      IMO ${esc(v.imoNo || '-')} · ${esc(v.carrierName || '-')} · ${esc(v.voyageNo || '')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
      <span style="font-family:var(--mono);font-size:25.5px;font-weight:700;color:${riskColor(v.topRiskScore)}">${v.topRiskScore || 0}</span>
      <span style="font-size:12.5px;color:var(--fg-3)">리스크 점수 · ${GRADE_LABEL[v.topRiskGrade] || '없음'}</span>
    </div>
    <div style="font-size:13px;color:var(--fg-2);border-top:1px solid var(--line);padding-top:8px">
      적재 화물 ${v.shipmentCount}건${v.provisional ? ' <span style="color:var(--warn)">(승인 대기)</span>' : ''}<br>
      ${v.shipments.slice(0,4).map(s => `· ${esc(s.shipmentNo)} <span style="color:var(--fg-3)">${esc(s.commodity)}</span>`).join('<br>')}
    </div>
    <div style="margin-top:9px;font-size:12.5px;color:var(--accent);cursor:pointer" data-open-vessel="${esc(v.voyageId)}">영향 건 보기 →</div>
  </div>`;
}

export function createMap(container, { onSelect } = {}) {
  const usable = typeof L !== 'undefined';
  if (!usable) return createSvgMap(container, { onSelect });

  const map = L.map(container, { worldCopyJump:true, zoomControl:true, minZoom:2, maxZoom:7, attributionControl:true })
    .setView([22, 62], 3);
  map.attributionControl.addAttribution(ATTR);
  const landLayer = L.layerGroup().addTo(map);
  loadWorld()
    .then(geo => L.geoJSON(geo, { style: LAND_STYLE, smoothFactor: 1.2 }).addTo(landLayer))
    .catch(() => {
      const n = container.parentElement.querySelector('.map-fallback-note');
      if (n) { n.style.display = 'block'; n.textContent = '지도 데이터를 불러오지 못했습니다. 좌표 기준으로만 표시합니다.'; }
    });
  // 위경도 그리드 (대양 위 위치 감각 보조)
  const grid = L.layerGroup().addTo(map);
  for (let lon = -180; lon <= 180; lon += 30)
    L.polyline([[-85, lon], [85, lon]], { color:'#1b2836', weight:.5, interactive:false }).addTo(grid);
  for (let lat = -60; lat <= 60; lat += 30)
    L.polyline([[lat, -180], [lat, 180]], { color:'#1b2836', weight:.5, interactive:false }).addTo(grid);
  L.polyline([[0, -180], [0, 180]], { color:'#22384a', weight:.8, dashArray:'5,6', interactive:false }).addTo(grid);

  const zoneLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const shipLayer = L.layerGroup().addTo(map);
  let state = { vessels: [], riskZones: [], selected: null, showZones: true, showRoutes: true };

  function draw() {
    zoneLayer.clearLayers(); routeLayer.clearLayers(); shipLayer.clearLayers();

    if (state.showZones) for (const z of state.riskZones) {
      const intensity = (z.impactLevel || z.severity) / 5;
      const col = riskColor(40 + intensity * 60);
      L.circle([z.lat, z.lon], { radius: (z.radiusKm || 80) * 1000, color: col, weight: 1.2,
        opacity: .55, fillColor: col, fillOpacity: .07 + intensity * .09, className:'risk-zone' })
        .bindTooltip(`<b>${esc(z.areaName)}</b><br>${esc(EVENT_TYPE_LABEL[z.eventType] || z.eventType)} · 영향도 ${z.impactLevel}/5<br>` +
          `<span style="color:#9fb3c8">${esc(z.eventTitle)}</span><br>예상 지연 ${z.expectedDelayDays}일 · 내 화물 ${z.myImpactedShipmentCount}건`,
          { sticky:true, className:'zone-tip' })
        .addTo(zoneLayer);
    }

    const sel = state.vessels.find(v => v.voyageId === state.selected);
    if (state.showRoutes) for (const v of state.vessels) {
      if (!v.waypoints || v.waypoints.length < 2) continue;
      const isSel = sel && v.voyageId === sel.voyageId;
      if (!isSel && state.selected) continue;
      L.polyline(v.waypoints.map(w => [w.lat, w.lon]), {
        color: isSel ? '#22d3ee' : riskColor(v.topRiskScore), weight: isSel ? 2 : 1,
        opacity: isSel ? .9 : .28, dashArray: isSel ? null : '3,5' }).addTo(routeLayer);
      if (isSel) v.waypoints.forEach(w => L.circleMarker([w.lat, w.lon],
        { radius: 3, color:'#22d3ee', fillColor:'#07131a', fillOpacity:1, weight:1.4 })
        .bindTooltip(`${esc(w.name)} · ${date(w.date)}`, { direction:'top' }).addTo(routeLayer));
    }

    for (const v of state.vessels) {
      if (v.currentLat == null) continue;
      const mk = L.marker([v.currentLat, v.currentLon], { icon: vesselIcon(v, v.voyageId === state.selected), riseOnHover:true })
        .bindPopup(popupHtml(v), { closeButton:true });
      mk.on('click', () => { state.selected = v.voyageId; draw(); onSelect && onSelect(v); });
      mk.addTo(shipLayer);
    }
  }

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-open-vessel]');
    if (t) { const v = state.vessels.find(x => x.voyageId === t.dataset.openVessel); if (v && onSelect) onSelect(v, true); }
  });

  return {
    kind: 'leaflet',
    render(next) { Object.assign(state, next); draw(); },
    select(voyageId, fly = true) {
      state.selected = voyageId; draw();
      const v = state.vessels.find(x => x.voyageId === voyageId);
      if (v && fly && v.currentLat != null) map.flyTo([v.currentLat, v.currentLon], Math.max(map.getZoom(), 4), { duration:.7 });
    },
    focus(lat, lon, z = 5) { map.flyTo([lat, lon], z, { duration:.7 }); },
    reset() { state.selected = null; draw(); map.flyTo([22, 62], 3, { duration:.7 }); },
    destroy() { map.remove(); }
  };
}

/* ── SVG 폴백: 타일 로드 불가 환경에서도 위치 관계를 보여준다 ── */
function createSvgMap(container, { onSelect } = {}) {
  const W = 1000, H = 520;
  const px = lon => ((lon + 180) / 360) * W;
  const py = lat => ((90 - lat) / 180) * H;
  let state = { vessels: [], riskZones: [], selected: null, showZones: true, showRoutes: true };
  container.style.background = '#050a10';

  function draw() {
    const grat = [];
    for (let lon = -180; lon <= 180; lon += 30) grat.push(`<line x1="${px(lon)}" y1="0" x2="${px(lon)}" y2="${H}" stroke="#12202e"/>`);
    for (let lat = -90; lat <= 90; lat += 30) grat.push(`<line x1="0" y1="${py(lat)}" x2="${W}" y2="${py(lat)}" stroke="#12202e"/>`);
    const zones = state.showZones ? state.riskZones.map(z => {
      const col = riskColor(40 + ((z.impactLevel || 3) / 5) * 60);
      const r = Math.max(6, (z.radiusKm || 80) / 28);
      return `<g><circle cx="${px(z.lon)}" cy="${py(z.lat)}" r="${r}" fill="${col}" fill-opacity=".1" stroke="${col}" stroke-opacity=".5"/>
        <text x="${px(z.lon)}" y="${py(z.lat) - r - 4}" fill="#7d8fa3" font-size="10.5" text-anchor="middle">${esc(z.areaName)}</text></g>`;
    }).join('') : '';
    const routes = state.showRoutes ? state.vessels.map(v => {
      if (!v.waypoints || v.waypoints.length < 2) return '';
      const sel = v.voyageId === state.selected;
      if (state.selected && !sel) return '';
      return `<polyline points="${v.waypoints.map(w => `${px(w.lon)},${py(w.lat)}`).join(' ')}" fill="none"
        stroke="${sel ? '#22d3ee' : riskColor(v.topRiskScore)}" stroke-opacity="${sel ? .9 : .3}" stroke-width="${sel ? 1.8 : 1}" ${sel ? '' : 'stroke-dasharray="3,5"'}/>`;
    }).join('') : '';
    const ships = state.vessels.filter(v => v.currentLat != null).map(v => {
      const c = v.topRiskScore ? riskColor(v.topRiskScore) : '#fff';
      const sel = v.voyageId === state.selected;
      return `<g class="svg-ship" data-voyage="${esc(v.voyageId)}" style="cursor:pointer">
        <rect x="${px(v.currentLon) - 5}" y="${py(v.currentLat) - 5}" width="10" height="10" rx="2" fill="${c}"
          transform="rotate(45 ${px(v.currentLon)} ${py(v.currentLat)})" stroke="${sel ? '#22d3ee' : 'rgba(0,0,0,.7)'}" stroke-width="${sel ? 2 : 1}"/>
        <title>${esc(v.vesselName)} · 점수 ${v.topRiskScore}</title></g>`;
    }).join('');
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">
      <rect width="${W}" height="${H}" fill="#050a10"/>${grat.join('')}
      <line x1="0" y1="${py(0)}" x2="${W}" y2="${py(0)}" stroke="#1d3243" stroke-dasharray="4,4"/>
      ${zones}${routes}${ships}</svg>`;
    container.querySelectorAll('.svg-ship').forEach(g => g.onclick = () => {
      state.selected = g.dataset.voyage; draw();
      const v = state.vessels.find(x => x.voyageId === g.dataset.voyage); if (v && onSelect) onSelect(v);
    });
  }
  const note = container.parentElement && container.parentElement.querySelector('.map-fallback-note');
  if (note) { note.style.display = 'block'; note.textContent = '지도 타일을 불러올 수 없어 개략 좌표 뷰로 표시합니다.'; }

  return { kind:'svg', render(next) { Object.assign(state, next); draw(); },
    select(id) { state.selected = id; draw(); }, focus() {}, reset() { state.selected = null; draw(); }, destroy() { container.innerHTML = ''; } };
}
