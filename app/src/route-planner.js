// SONAR - 항로 경유 요충지 추천 (화물 등록 보조, FR-03 입력 데이터 생성)
import db from './db.js';

const R_NM = 3440.065;
const rad = d => (d * Math.PI) / 180;
export function distanceNm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const REGION = id => (db.ports.find(p => p.portId === id) || {}).regionCode;
const CC = id => (db.ports.find(p => p.portId === id) || {}).countryCode;
const cp = code => db.chokePoints.find(c => c.code === code);

const ASIA = ['NEA', 'SEA'];
// 실제 항로 통과 순서(동→서 기준). 서→동 항로에서는 역순으로 적용한다.
const CORRIDOR_ORDER = { TAIWAN:1, MALACCA:2, HORMUZ:3, GOODHOPE:4, BAB:5, REDSEA:6, SUEZ:7, GIB:8, PANAMA:9 };
const GULF_COUNTRIES = ['IR', 'IQ', 'KW', 'QA', 'BH'];

/** 출발/도착 항만으로부터 통과 예상 해상 요충지 목록을 도출한다. */
export function suggestChokePoints(originPortId, destinationPortId, { preferCapeRoute = false } = {}) {
  const o = REGION(originPortId), d = REGION(destinationPortId);
  const codes = [];
  const asiaToWest = ASIA.includes(o) && ['EUR', 'MEA', 'SAS', 'AFR'].includes(d);
  const westToAsia = ASIA.includes(d) && ['EUR', 'MEA', 'SAS', 'AFR'].includes(o);

  if (asiaToWest || westToAsia) codes.push('MALACCA');
  if ((ASIA.includes(o) && d === 'EUR') || (ASIA.includes(d) && o === 'EUR') ||
      (o === 'SAS' && d === 'EUR') || (o === 'EUR' && d === 'SAS')) {
    if (preferCapeRoute) codes.push('GOODHOPE', 'GIB');
    else codes.push('BAB', 'REDSEA', 'SUEZ');
  }
  if (GULF_COUNTRIES.includes(CC(originPortId)) || GULF_COUNTRIES.includes(CC(destinationPortId))) codes.push('HORMUZ');
  if ((ASIA.includes(o) && ['USNYC'].includes((db.ports.find(p => p.portId === destinationPortId) || {}).unlocode)) ||
      (o === 'NAM' && d === 'LAM') || (o === 'LAM' && d === 'NAM')) codes.push('PANAMA');
  if (o === 'NEA' && ['SEA', 'SAS', 'MEA', 'EUR'].includes(d) && CC(originPortId) !== 'TW') codes.push('TAIWAN');
  if (['EUR'].includes(o) && d === 'EUR') codes.push('GIB');

  const seen = new Set();
  return codes.map(cp).filter(c => c && !seen.has(c.code) && seen.add(c.code));
}

/** 요충지 순서를 출발지 기준 거리 순으로 정렬하고 통과 예정일을 추정한다. */
export function planRoute(originPortId, destinationPortId, etd, opts = {}) {
  const origin = db.ports.find(p => p.portId === originPortId);
  const dest = db.ports.find(p => p.portId === destinationPortId);
  if (!origin || !dest) return null;

  const eastbound = ['EUR', 'MEA', 'SAS', 'AFR'].includes(REGION(originPortId)) && ASIA.includes(REGION(destinationPortId));
  const dir = eastbound ? -1 : 1;
  const chokes = suggestChokePoints(originPortId, destinationPortId, opts)
    .sort((a, b) => dir * ((CORRIDOR_ORDER[a.code] || 99) - (CORRIDOR_ORDER[b.code] || 99)));

  const speedKn = opts.speedKn || 17.5;
  const waypoints = [origin, ...chokes, dest];
  let cumNm = 0;
  const legs = [];
  for (let i = 1; i < waypoints.length; i++) {
    cumNm += distanceNm(waypoints[i - 1], waypoints[i]);
    legs.push({ node: waypoints[i], cumNm });
  }
  const start = new Date(etd + 'T00:00:00Z').getTime();
  const dayMs = 86400000;
  const hoursFor = nm => nm / speedKn;

  const routePoints = [];
  chokes.forEach((c, idx) => {
    const leg = legs[idx];
    const dwellDays = idx * 0.5;
    const date = new Date(start + (hoursFor(leg.cumNm) / 24 + dwellDays) * dayMs);
    routePoints.push({ seq: idx + 1, chokePointId: c.chokePointId, code: c.code, nameKo: c.nameKo,
      lat: c.lat, lon: c.lon, expectedPassageDate: date.toISOString().slice(0, 10) });
  });
  const totalNm = legs[legs.length - 1].cumNm;
  const transitDays = Math.ceil(hoursFor(totalNm) / 24 + chokes.length * 0.5 + 1);
  const eta = new Date(start + transitDays * dayMs).toISOString().slice(0, 10);

  return {
    originPort: { portId: origin.portId, unlocode: origin.unlocode, nameKo: origin.nameKo, lat: origin.lat, lon: origin.lon },
    destinationPort: { portId: dest.portId, unlocode: dest.unlocode, nameKo: dest.nameKo, lat: dest.lat, lon: dest.lon },
    etd, eta, transitDays, distanceNm: Math.round(totalNm), assumedSpeedKn: speedKn,
    preferCapeRoute: !!opts.preferCapeRoute, routePoints
  };
}
