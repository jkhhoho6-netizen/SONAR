// SONAR - REST API 라우트 정의 및 핸들러
import { randomUUID } from 'node:crypto';
import db from './db.js';
import * as V from './view.js';
import { recomputeMatches, gradeOfScore, GRADE_ORDER, dayDiff } from './risk.js';
import { planRoute } from './route-planner.js';

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
const bad    = (m, d) => new ApiError(400, 'VALIDATION_ERROR', m, d);
const unauth = (m = '인증이 필요합니다.') => new ApiError(401, 'UNAUTHORIZED', m);
const forbid = (m = '접근 권한이 없습니다.') => new ApiError(403, 'FORBIDDEN', m);
const notfound = (m = '요청한 리소스를 찾을 수 없습니다.') => new ApiError(404, 'NOT_FOUND', m);
const conflict = (c, m) => new ApiError(409, c, m);

export const routes = [];
function on(method, pattern, handler, opts = {}) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:([A-Za-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, pattern, regex, keys, handler, auth: opts.auth !== false, roles: opts.roles || null });
}

function require_(v, name) { if (v === undefined || v === null || v === '') throw bad(`필수 항목이 누락되었습니다: ${name}`, [{ field: name, reason: 'REQUIRED' }]); return v; }
function paginate(list, q) {
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const size = Math.min(200, Math.max(1, parseInt(q.size || '50', 10)));
  return { items: list.slice((page - 1) * size, page * size), page, size, total: list.length, totalPages: Math.ceil(list.length / size) || 1 };
}
const audit = (actorUserId, action, targetType, targetId, detail) =>
  db.auditLogs.unshift({ auditId: db.nextId('AL'), actorUserId, action, targetType, targetId, detail, ip: '10.30.8.12', createdAt: db.now() });

/* ────────────────────────── 인증 ────────────────────────── */

on('POST', '/api/v1/auth/signup', ({ body }) => {
  const { email, password, name, phone, department, role } = body;
  ['email', 'password', 'name'].forEach(f => require_(body[f], f));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('이메일 형식이 올바르지 않습니다.', [{ field: 'email', reason: 'FORMAT' }]);
  if (String(password).length < 8) throw bad('비밀번호는 8자 이상이어야 합니다.', [{ field: 'password', reason: 'MIN_LENGTH' }]);
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw conflict('DUPLICATE_EMAIL', '이미 가입된 이메일입니다.');

  let companyId = body.companyId;
  if (!companyId) {
    const companyName = require_(body.companyName, 'companyName');
    const found = db.companies.find(c => c.name === companyName);
    if (found) companyId = found.companyId;
    else {
      companyId = db.nextId('C');
      db.companies.push({ companyId, name: companyName, bizRegNo: body.bizRegNo || null,
        companyType: body.companyType || 'SHIPPER', createdAt: db.now() });
    }
  } else if (!db.companies.some(c => c.companyId === companyId)) throw notfound('존재하지 않는 회사입니다.');

  const user = { userId: db.nextId('U'), companyId, email, password, name, phone: phone || null,
    role: role === 'ADMIN' ? 'OPERATOR' : 'OPERATOR', status: 'PENDING', department: department || null,
    createdAt: db.now(), approvedAt: null, approvedBy: null, lastLoginAt: null };
  db.users.push(user);
  audit(user.userId, 'USER_SIGNUP', 'USER', user.userId, `${name} 가입 신청`);
  return { status: 201, body: { ...V.userDto(user), message: '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' } };
}, { auth: false });

on('POST', '/api/v1/auth/login', ({ body }) => {
  const email = require_(body.email, 'email');
  const password = require_(body.password, 'password');
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || user.password !== password) throw new ApiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  if (user.status === 'PENDING')  throw new ApiError(403, 'ACCOUNT_PENDING',  '관리자 승인 대기 중인 계정입니다.');
  if (user.status === 'REJECTED') throw new ApiError(403, 'ACCOUNT_REJECTED', `가입이 반려된 계정입니다. 사유: ${user.rejectReason || '-'}`);
  if (user.status === 'SUSPENDED')throw new ApiError(403, 'ACCOUNT_SUSPENDED','정지된 계정입니다. 관리자에게 문의하세요.');
  const accessToken = randomUUID();
  db.sessions.set(accessToken, { userId: user.userId, issuedAt: db.now() });
  user.lastLoginAt = db.now();
  return { accessToken, tokenType: 'Bearer', expiresIn: 3600, user: V.userDto(user) };
}, { auth: false });

on('POST', '/api/v1/auth/logout', ({ token }) => { db.sessions.delete(token); return { status: 204 }; });
on('GET',  '/api/v1/auth/me', ({ user }) => V.userDto(user));

/* ────────────────────────── 마스터 ────────────────────────── */

on('GET', '/api/v1/companies', () => ({ items: db.companies.filter(c => c.companyType !== 'PLATFORM') }), { auth: false });
on('GET', '/api/v1/ports', ({ query }) => {
  const q = (query.query || '').toLowerCase();
  const items = db.ports.filter(p => !q || p.nameKo.includes(query.query) || p.nameEn.toLowerCase().includes(q) || p.unlocode.toLowerCase().includes(q));
  return { items: items.map(p => V.portRef(p.portId)), total: items.length };
});
on('GET', '/api/v1/choke-points', () => ({ items: db.chokePoints, total: db.chokePoints.length }));
on('GET', '/api/v1/carriers', () => ({ items: db.carriers, total: db.carriers.length }));
on('GET', '/api/v1/voyages', ({ query }) => {
  const q = (query.query || '').toLowerCase();
  const items = db.voyages.map(V.vesselDto).filter(v => !q || v.vesselName.toLowerCase().includes(q) || v.voyageNo.toLowerCase().includes(q));
  return { items, total: items.length };
});
on('POST', '/api/v1/routes/preview', ({ body }) => {
  ['originPortId', 'destinationPortId', 'etd'].forEach(f => require_(body[f], f));
  if (body.originPortId === body.destinationPortId) throw bad('출발항과 도착항이 동일합니다.', [{ field: 'destinationPortId', reason: 'SAME_AS_ORIGIN' }]);
  const plan = planRoute(body.originPortId, body.destinationPortId, body.etd, { preferCapeRoute: !!body.preferCapeRoute });
  if (!plan) throw notfound('항만 코드를 확인할 수 없습니다.');
  return plan;
});

/* ────────────────────────── 스코프 헬퍼 ────────────────────────── */

const visibleShipments = user => user.role === 'ADMIN' ? db.shipments : db.shipments.filter(s => s.companyId === user.companyId);
const visibleMatches   = user => user.role === 'ADMIN' ? db.impactMatches : db.impactMatches.filter(m => m.companyId === user.companyId);

/* ────────────────────────── 대시보드 (FR-05) ────────────────────────── */

on('GET', '/api/v1/dashboard/summary', ({ user, query }) => {
  let ms = visibleMatches(user).filter(m => m.status !== 'FALSE_POSITIVE');
  if (query.scope === 'mine') {
    const mine = new Set(db.shipments.filter(s => s.ownerUserId === user.userId).map(s => s.shipmentId));
    ms = ms.filter(m => mine.has(m.shipmentId));
  }
  const shipments = visibleShipments(user);
  const byGrade = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  ms.forEach(m => { byGrade[m.riskGrade]++; });
  const exposedIds = new Set(ms.map(m => m.shipmentId));
  const exposedValue = [...exposedIds].reduce((sum, id) => sum + ((V.findShipment(id) || {}).cargoValueUsd || 0), 0);
  const byEvent = {};
  ms.forEach(m => { (byEvent[m.eventId] = byEvent[m.eventId] || []).push(m); });

  return {
    baseDate: db.now().slice(0, 10),
    gradeCounts: byGrade,
    totalMatchCount: ms.length,
    openMatchCount: ms.filter(m => m.status === 'OPEN').length,
    actionTakenCount: ms.filter(m => m.status === 'ACTION_TAKEN' || m.status === 'RESOLVED').length,
    trackedShipmentCount: shipments.filter(s => ['ACTIVE', 'IN_TRANSIT'].includes(s.status)).length,
    exposedShipmentCount: exposedIds.size,
    exposedCargoValueUsd: exposedValue,
    maxExpectedDelayDays: ms.length ? Math.max(...ms.map(m => m.expectedDelayDays || 0)) : 0,
    pendingApprovalShipmentCount: shipments.filter(s => s.status === 'PENDING_APPROVAL').length,
    unreadNotificationCount: db.notifications.filter(n => n.recipientUserId === user.userId && n.status === 'SENT' && !n.readAt).length,
    topEvents: Object.entries(byEvent)
      .map(([eventId, list]) => ({ ...V.eventSummaryDto(V.findEvent(eventId)),
        myImpactedCount: list.length, myTopRiskScore: Math.max(...list.map(x => x.riskScore)) }))
      .sort((a, b) => b.myTopRiskScore - a.myTopRiskScore).slice(0, 5),
    priorityMatches: ms.slice().sort((a, b) => b.riskScore - a.riskScore).slice(0, 10).map(V.matchSummaryDto)
  };
});

on('GET', '/api/v1/dashboard/map', ({ user, query }) => {
  let shipments = visibleShipments(user).filter(s => !['REJECTED', 'ARRIVED', 'CANCELLED'].includes(s.status));
  if (query.scope === 'mine') shipments = shipments.filter(s => s.ownerUserId === user.userId);
  if (query.grade) {
    const min = GRADE_ORDER[query.grade] || 0;
    shipments = shipments.filter(s => GRADE_ORDER[V.shipmentRiskSummary(s.shipmentId).topRiskGrade] >= min);
  }
  const byVoyage = new Map();
  for (const s of shipments) {
    if (!s.voyageId) continue;
    if (!byVoyage.has(s.voyageId)) byVoyage.set(s.voyageId, []);
    byVoyage.get(s.voyageId).push(s);
  }
  const vessels = [...byVoyage.entries()].map(([voyageId, list]) => {
    const voyage = V.findVoyage(voyageId);
    const risks = list.map(s => V.shipmentRiskSummary(s.shipmentId));
    const topRiskScore = Math.max(0, ...risks.map(r => r.topRiskScore));
    return {
      ...V.vesselDto(voyage),
      topRiskScore,
      topRiskGrade: topRiskScore ? gradeOfScore(topRiskScore, db.riskThresholds) : 'NONE',
      shipmentCount: list.length,
      provisional: list.every(s => s.status === 'PENDING_APPROVAL'),
      shipments: list.map(s => ({ shipmentId: s.shipmentId, shipmentNo: s.shipmentNo, commodity: s.commodity,
        status: s.status, ...V.shipmentRiskSummary(s.shipmentId) })),
      waypoints: V.voyageWaypoints(voyage)
    };
  }).sort((a, b) => b.topRiskScore - a.topRiskScore);

  const activeEvents = db.riskEvents.filter(e => e.status === 'PUBLISHED');
  const riskZones = db.eventAreas
    .filter(a => activeEvents.some(e => e.eventId === a.eventId))
    .map(a => {
      const e = V.findEvent(a.eventId);
      const geo = a.portId ? V.portRef(a.portId) : V.chokeRef(a.chokePointId);
      if (!geo) return null;
      const impacted = db.impactMatches.filter(m => m.eventAreaId === a.eventAreaId &&
        (user.role === 'ADMIN' || m.companyId === user.companyId));
      return { eventAreaId: a.eventAreaId, eventId: e.eventId, eventTitle: e.title, eventType: e.eventType,
        areaType: a.areaType, areaName: a.portId ? geo.nameKo : geo.nameKo,
        lat: geo.lat, lon: geo.lon, radiusKm: a.chokePointId ? geo.radiusKm : 60,
        severity: e.severity, impactLevel: a.impactLevel, expectedDelayDays: a.expectedDelayDays,
        startDate: e.startDate, endDate: e.expectedEndDate, myImpactedShipmentCount: impacted.length };
    }).filter(Boolean);

  return { baseDate: db.now(), vessels, riskZones, unassignedShipmentCount: shipments.filter(s => !s.voyageId).length };
});

/* ────────────────────────── 화물 ────────────────────────── */

on('GET', '/api/v1/shipments', ({ user, query }) => {
  let list = visibleShipments(user);
  if (query.scope === 'mine') list = list.filter(s => s.ownerUserId === user.userId);
  if (query.status) list = list.filter(s => query.status.split(',').includes(s.status));
  if (query.grade)  list = list.filter(s => V.shipmentRiskSummary(s.shipmentId).topRiskGrade === query.grade);
  if (query.keyword) {
    const k = query.keyword.toLowerCase();
    list = list.filter(s => s.shipmentNo.toLowerCase().includes(k) || s.commodity.toLowerCase().includes(k) ||
      (s.customerName || '').toLowerCase().includes(k) || (s.containerNo || '').toLowerCase().includes(k));
  }
  const dto = list.map(V.shipmentSummaryDto);
  const sort = query.sort || 'risk';
  dto.sort(sort === 'eta' ? (a, b) => String(a.eta).localeCompare(String(b.eta))
       : sort === 'value' ? (a, b) => b.cargoValueUsd - a.cargoValueUsd
       : (a, b) => b.topRiskScore - a.topRiskScore);
  return paginate(dto, query);
});

on('GET', '/api/v1/shipments/:shipmentId', ({ user, params }) => {
  const s = V.findShipment(params.shipmentId);
  if (!s) throw notfound('화물을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && s.companyId !== user.companyId) throw forbid('다른 회사의 화물은 조회할 수 없습니다.');
  return V.shipmentDetailDto(s);
});

on('POST', '/api/v1/shipments', ({ user, body }) => {
  ['commodity', 'originPortId', 'destinationPortId', 'etd', 'eta', 'cargoValueUsd'].forEach(f => require_(body[f], f));
  if (body.originPortId === body.destinationPortId) throw bad('출발항과 도착항이 동일합니다.', [{ field: 'destinationPortId', reason: 'SAME_AS_ORIGIN' }]);
  if (dayDiff(body.eta, body.etd) < 0) throw bad('도착 예정일(ETA)은 출항 예정일(ETD)보다 빠를 수 없습니다.', [{ field: 'eta', reason: 'BEFORE_ETD' }]);
  if (Number(body.cargoValueUsd) <= 0) throw bad('화물 가액은 0보다 커야 합니다.', [{ field: 'cargoValueUsd', reason: 'MIN_VALUE' }]);
  if (body.customerDueDate && dayDiff(body.customerDueDate, body.eta) < 0)
    throw bad('고객 납기일이 도착 예정일보다 빠릅니다. 일정을 확인하세요.', [{ field: 'customerDueDate', reason: 'BEFORE_ETA' }]);
  for (const f of ['originPortId', 'destinationPortId']) if (!V.findPort(body[f])) throw notfound(`존재하지 않는 항만입니다: ${body[f]}`);
  if (body.voyageId && !V.findVoyage(body.voyageId)) throw notfound('존재하지 않는 항차입니다.');

  const seq = db.shipments.length + 1;
  const s = {
    shipmentId: db.nextId('SH'),
    shipmentNo: body.shipmentNo || `SNR-2026-${String(seq).padStart(4, '0')}`,
    companyId: user.companyId, ownerUserId: user.userId,
    voyageId: body.voyageId || null,
    originPortId: body.originPortId, destinationPortId: body.destinationPortId,
    commodity: body.commodity, cargoValueUsd: Number(body.cargoValueUsd), currency: body.currency || 'USD',
    etd: body.etd, eta: body.eta, customerDueDate: body.customerDueDate || body.eta,
    alternativeRouteAvailable: !!body.alternativeRouteAvailable,
    status: 'PENDING_APPROVAL',
    incoterms: body.incoterms || 'FOB', containerNo: body.containerNo || null,
    containerType: body.containerType || '40HC', containerCount: Number(body.containerCount || 1),
    weightKg: Number(body.weightKg || 0), customerName: body.customerName || null, memo: body.memo || null,
    rejectReason: null, createdAt: db.now(), approvedAt: null, approvedBy: null,
    routePoints: (body.routePoints || []).map((rp, i) => ({ seq: i + 1, chokePointId: rp.chokePointId, expectedPassageDate: rp.expectedPassageDate }))
  };
  if (!s.routePoints.length) {
    // 항차가 배정되면 해당 항차의 실제 통과 예정 지점을, 아니면 항로 추천 결과를 사용한다.
    const voyage = s.voyageId ? V.findVoyage(s.voyageId) : null;
    if (voyage && voyage.transits.length) {
      s.routePoints = voyage.transits.map((t, i) => ({ seq: i + 1, ...t }));
    } else {
      const plan = planRoute(s.originPortId, s.destinationPortId, s.etd, { preferCapeRoute: !!body.preferCapeRoute });
      s.routePoints = plan ? plan.routePoints.map(rp => ({ seq: rp.seq, chokePointId: rp.chokePointId, expectedPassageDate: rp.expectedPassageDate })) : [];
    }
  }
  db.shipments.push(s);
  recomputeMatches(db);
  audit(user.userId, 'SHIPMENT_CREATE', 'SHIPMENT', s.shipmentId, `${s.shipmentNo} 등록 신청`);
  return { status: 201, body: V.shipmentDetailDto(s) };
});

on('PATCH', '/api/v1/shipments/:shipmentId', ({ user, params, body }) => {
  const s = V.findShipment(params.shipmentId);
  if (!s) throw notfound('화물을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && s.ownerUserId !== user.userId) throw forbid('본인이 등록한 화물만 수정할 수 있습니다.');
  if (s.status === 'ARRIVED') throw conflict('INVALID_STATE', '이미 도착 처리된 화물은 수정할 수 없습니다.');
  const editable = ['commodity', 'cargoValueUsd', 'etd', 'eta', 'customerDueDate', 'alternativeRouteAvailable',
    'voyageId', 'incoterms', 'containerNo', 'containerType', 'containerCount', 'weightKg', 'customerName', 'memo'];
  editable.forEach(f => { if (body[f] !== undefined) s[f] = body[f]; });
  if (body.routePoints) s.routePoints = body.routePoints.map((rp, i) => ({ seq: i + 1, ...rp }));
  if (s.status === 'REJECTED') { s.status = 'PENDING_APPROVAL'; s.rejectReason = null; }
  recomputeMatches(db);
  audit(user.userId, 'SHIPMENT_UPDATE', 'SHIPMENT', s.shipmentId, `${s.shipmentNo} 수정`);
  return V.shipmentDetailDto(s);
});

on('DELETE', '/api/v1/shipments/:shipmentId', ({ user, params }) => {
  const idx = db.shipments.findIndex(s => s.shipmentId === params.shipmentId);
  if (idx < 0) throw notfound('화물을 찾을 수 없습니다.');
  const s = db.shipments[idx];
  if (user.role !== 'ADMIN' && s.ownerUserId !== user.userId) throw forbid('본인이 등록한 화물만 삭제할 수 있습니다.');
  if (s.status === 'IN_TRANSIT') throw conflict('INVALID_STATE', '운송 중인 화물은 삭제할 수 없습니다. 취소 처리를 이용하세요.');
  db.shipments.splice(idx, 1);
  recomputeMatches(db);
  audit(user.userId, 'SHIPMENT_DELETE', 'SHIPMENT', s.shipmentId, `${s.shipmentNo} 삭제`);
  return { status: 204 };
});

/* ────────────────────────── 리스크 이벤트 ────────────────────────── */

on('GET', '/api/v1/risk-events', ({ user, query }) => {
  let list = db.riskEvents.filter(e => e.status === 'PUBLISHED');
  if (query.eventType) list = list.filter(e => query.eventType.split(',').includes(e.eventType));
  if (query.from) list = list.filter(e => e.expectedEndDate >= query.from);
  if (query.to)   list = list.filter(e => e.startDate <= query.to);
  if (query.keyword) list = list.filter(e => e.title.includes(query.keyword) || e.summary.includes(query.keyword));
  const dto = list.map(e => {
    const base = V.eventSummaryDto(e);
    const mine = db.impactMatches.filter(m => m.eventId === e.eventId && (user.role === 'ADMIN' || m.companyId === user.companyId));
    return { ...base, myImpactedCount: mine.length, myTopRiskScore: mine.length ? Math.max(...mine.map(m => m.riskScore)) : 0 };
  });
  if (query.onlyImpacted === 'true') return paginate(dto.filter(d => d.myImpactedCount > 0).sort((a, b) => b.myTopRiskScore - a.myTopRiskScore), query);
  dto.sort((a, b) => b.myTopRiskScore - a.myTopRiskScore || b.severity - a.severity);
  return paginate(dto, query);
});

on('GET', '/api/v1/risk-events/:eventId', ({ user, params }) => {
  const e = V.findEvent(params.eventId);
  if (!e) throw notfound('리스크 이벤트를 찾을 수 없습니다.');
  if (e.status !== 'PUBLISHED' && user.role !== 'ADMIN') throw forbid('아직 발행되지 않은 이벤트입니다.');
  return V.eventDetailDto(e, user.role === 'ADMIN' ? {} : { companyId: user.companyId });
});

/* ────────────────────────── 영향 건 (매칭) ────────────────────────── */

on('GET', '/api/v1/matches', ({ user, query }) => {
  let list = visibleMatches(user);
  if (query.scope === 'mine') {
    const mine = new Set(db.shipments.filter(s => s.ownerUserId === user.userId).map(s => s.shipmentId));
    list = list.filter(m => mine.has(m.shipmentId));
  }
  if (query.grade)   list = list.filter(m => query.grade.split(',').includes(m.riskGrade));
  if (query.status)  list = list.filter(m => query.status.split(',').includes(m.status));
  if (query.eventId) list = list.filter(m => m.eventId === query.eventId);
  if (query.shipmentId) list = list.filter(m => m.shipmentId === query.shipmentId);
  if (query.minScore) list = list.filter(m => m.riskScore >= Number(query.minScore));
  const dto = list.map(V.matchSummaryDto);
  const sort = query.sort || 'score';
  dto.sort(sort === 'date' ? (a, b) => String(a.exposureDate).localeCompare(String(b.exposureDate)) : (a, b) => b.riskScore - a.riskScore);
  return paginate(dto, query);
});

on('GET', '/api/v1/matches/:matchId', ({ user, params }) => {
  const m = V.findMatch(params.matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  return V.matchDetailDto(m);
});

on('PATCH', '/api/v1/matches/:matchId', ({ user, params, body }) => {
  const m = V.findMatch(params.matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  const allowed = ['OPEN', 'ACKNOWLEDGED', 'ACTION_TAKEN', 'RESOLVED', 'FALSE_POSITIVE'];
  const status = require_(body.status, 'status');
  if (!allowed.includes(status)) throw bad(`status 는 ${allowed.join(', ')} 중 하나여야 합니다.`, [{ field: 'status', reason: 'ENUM' }]);
  m.status = status; m.updatedAt = db.now();
  return V.matchDetailDto(m);
});

on('GET', '/api/v1/matches/:matchId/playbooks', ({ user, params }) => {
  const m = V.findMatch(params.matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  const e = V.findEvent(m.eventId);
  const items = db.responsePlaybooks
    .filter(p => (p.eventType === e.eventType || p.eventType === '*') && GRADE_ORDER[m.riskGrade] >= GRADE_ORDER[p.minGrade])
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { matchId: m.matchId, riskGrade: m.riskGrade, eventType: e.eventType, items, total: items.length };
});

on('POST', '/api/v1/matches/:matchId/actions', ({ user, params, body }) => {
  const m = V.findMatch(params.matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  const actionType = require_(body.actionType, 'actionType');
  const content = require_(body.content, 'content');
  if (String(content).trim().length < 5) throw bad('조치 내용은 5자 이상 입력해야 합니다.', [{ field: 'content', reason: 'MIN_LENGTH' }]);
  const a = { actionId: db.nextId('AC'), matchId: m.matchId, shipmentId: m.shipmentId,
    playbookId: body.playbookId || null, userId: user.userId, actionType,
    content, result: body.result || 'PENDING', resultNote: body.resultNote || null,
    actedAt: body.actedAt || db.now(), createdAt: db.now() };
  db.actionLogs.push(a);
  if (m.status === 'OPEN' || m.status === 'ACKNOWLEDGED') { m.status = 'ACTION_TAKEN'; m.updatedAt = db.now(); }
  audit(user.userId, 'ACTION_CREATE', 'MATCH', m.matchId, `${actionType} 조치 등록`);
  return { status: 201, body: V.actionDto(a) };
});

on('PATCH', '/api/v1/actions/:actionId', ({ user, params, body }) => {
  const a = db.actionLogs.find(x => x.actionId === params.actionId);
  if (!a) throw notfound('조치 기록을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && a.userId !== user.userId) throw forbid('본인이 등록한 조치만 수정할 수 있습니다.');
  ['content', 'result', 'resultNote', 'actionType'].forEach(f => { if (body[f] !== undefined) a[f] = body[f]; });
  return V.actionDto(a);
});

on('POST', '/api/v1/matches/:matchId/feedback', ({ user, params, body }) => {
  const m = V.findMatch(params.matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  if (typeof body.isRelevant !== 'boolean') throw bad('isRelevant 는 true/false 여야 합니다.', [{ field: 'isRelevant', reason: 'TYPE' }]);
  const f = { feedbackId: db.nextId('FB'), matchId: m.matchId, shipmentId: m.shipmentId, userId: user.userId,
    isRelevant: body.isRelevant, actualDelayDays: body.actualDelayDays ?? null,
    comment: body.comment || null, createdAt: db.now() };
  db.matchFeedbacks.push(f);
  if (!body.isRelevant) { m.status = 'FALSE_POSITIVE'; m.updatedAt = db.now(); }
  audit(user.userId, 'MATCH_FEEDBACK', 'MATCH', m.matchId, body.isRelevant ? '실제 영향 확인' : '오탐 신고');
  return { status: 201, body: V.feedbackDto(f) };
});

/* ────────────────────────── 알림 (FR-07) ────────────────────────── */

on('GET', '/api/v1/notifications', ({ user, query }) => {
  let list = db.notifications.filter(n => n.recipientUserId === user.userId || (user.role === 'ADMIN' && query.scope === 'all'));
  if (query.status) list = list.filter(n => query.status.split(',').includes(n.status));
  if (query.unreadOnly === 'true') list = list.filter(n => !n.readAt && n.status === 'SENT');
  const dto = list.map(V.notificationDto).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { ...paginate(dto, query), unreadCount: db.notifications.filter(n => n.recipientUserId === user.userId && n.status === 'SENT' && !n.readAt).length };
});

on('POST', '/api/v1/notifications', ({ user, body }) => {
  const matchId = require_(body.matchId, 'matchId');
  const m = V.findMatch(matchId);
  if (!m) throw notfound('영향 건을 찾을 수 없습니다.');
  if (user.role !== 'ADMIN' && m.companyId !== user.companyId) throw forbid();
  const scope = body.scope === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
  const threshold = db.riskThresholds.find(t => t.grade === m.riskGrade);
  if (threshold && !threshold.notifyEnabled)
    throw conflict('NOTIFY_DISABLED', `${m.riskGrade} 등급은 알림 발송이 비활성화되어 있습니다. 관리자에게 임계값 설정을 요청하세요.`);
  const needsApproval = scope === 'EXTERNAL' || (threshold && threshold.requiresApproval && scope === 'EXTERNAL');
  const s = V.findShipment(m.shipmentId);
  const n = { notificationId: db.nextId('NT'), matchId: m.matchId, eventId: m.eventId, shipmentId: m.shipmentId,
    recipientUserId: body.recipientUserId || s.ownerUserId, channel: body.channel || 'ALIMTALK', scope,
    title: body.title || `[${m.riskGrade}] ${s.shipmentNo} 리스크 알림`,
    message: body.message || `${V.findEvent(m.eventId).title} 로 인해 ${s.shipmentNo} 에 영향이 예상됩니다.`,
    status: needsApproval ? 'PENDING_APPROVAL' : 'SENT',
    requestedBy: user.userId, approvedBy: null, approvedAt: null,
    sentAt: needsApproval ? null : db.now(), readAt: null, failReason: null, createdAt: db.now() };
  db.notifications.push(n);
  audit(user.userId, 'NOTIFICATION_REQUEST', 'NOTIFICATION', n.notificationId, `${scope} 알림 ${needsApproval ? '승인 요청' : '발송'}`);
  return { status: 201, body: V.notificationDto(n) };
});

on('PATCH', '/api/v1/notifications/:notificationId/read', ({ user, params }) => {
  const n = db.notifications.find(x => x.notificationId === params.notificationId);
  if (!n) throw notfound('알림을 찾을 수 없습니다.');
  if (n.recipientUserId !== user.userId && user.role !== 'ADMIN') throw forbid();
  n.readAt = n.readAt || db.now();
  return V.notificationDto(n);
});

/* ────────────────────────── 관리자 ────────────────────────── */
const ADMIN = { roles: ['ADMIN'] };

on('GET', '/api/v1/admin/overview', () => {
  const published = db.riskEvents.filter(e => e.status === 'PUBLISHED');
  const byGrade = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  db.impactMatches.forEach(m => { byGrade[m.riskGrade]++; });
  const fb = db.matchFeedbacks;
  return {
    baseDate: db.now(),
    users: { total: db.users.length, active: db.users.filter(u => u.status === 'ACTIVE').length,
             pending: db.users.filter(u => u.status === 'PENDING').length, rejected: db.users.filter(u => u.status === 'REJECTED').length },
    companies: { total: db.companies.filter(c => c.companyType !== 'PLATFORM').length },
    shipments: { total: db.shipments.length, pendingApproval: db.shipments.filter(s => s.status === 'PENDING_APPROVAL').length,
                 inTransit: db.shipments.filter(s => s.status === 'IN_TRANSIT').length },
    pipeline: {
      enabledSourceCount: db.riskSources.filter(s => s.enabled).length,
      totalSourceCount: db.riskSources.length,
      collectedToday: db.rawFeeds.filter(f => f.collectedAt.slice(0, 10) === db.now().slice(0, 10)).length,
      totalFeedCount: db.rawFeeds.length,
      pendingFeedCount: db.rawFeeds.filter(f => f.processStatus === 'PENDING').length,
      discardedFeedCount: db.rawFeeds.filter(f => f.processStatus === 'DISCARDED').length,
      draftEventCount: db.riskEvents.filter(e => e.status === 'DRAFT').length,
      publishedEventCount: published.length,
      dismissedEventCount: db.riskEvents.filter(e => e.status === 'DISMISSED').length,
      lastCollectedAt: db.riskSources.map(s => s.lastCollectedAt).sort().reverse()[0]
    },
    matches: { total: db.impactMatches.length, byGrade,
               falsePositive: db.impactMatches.filter(m => m.status === 'FALSE_POSITIVE').length },
    notifications: { pendingApproval: db.notifications.filter(n => n.status === 'PENDING_APPROVAL').length,
                     sent: db.notifications.filter(n => n.status === 'SENT').length,
                     failed: db.notifications.filter(n => n.status === 'FAILED').length },
    feedback: { total: fb.length, falsePositive: fb.filter(f => !f.isRelevant).length,
                precision: fb.length ? Number((fb.filter(f => f.isRelevant).length / fb.length).toFixed(3)) : null },
    recentJobs: db.collectionJobs.slice(0, 6).map(j => ({ ...j, sourceName: (db.riskSources.find(s => s.sourceId === j.sourceId) || {}).name })),
    recentAudits: db.auditLogs.slice(0, 8).map(a => ({ ...a, actorName: (V.findUser(a.actorUserId) || {}).name || a.actorUserId }))
  };
}, ADMIN);

on('GET', '/api/v1/admin/users', ({ query }) => {
  let list = db.users.filter(u => u.companyId !== 'C000');
  if (query.status) list = list.filter(u => query.status.split(',').includes(u.status));
  if (query.companyId) list = list.filter(u => u.companyId === query.companyId);
  if (query.keyword) {
    const k = query.keyword.toLowerCase();
    list = list.filter(u => u.name.includes(query.keyword) || u.email.toLowerCase().includes(k));
  }
  const dto = list.map(u => ({ ...V.userDto(u), shipmentCount: db.shipments.filter(s => s.ownerUserId === u.userId).length }))
    .sort((a, b) => (a.status === 'PENDING' ? -1 : 0) - (b.status === 'PENDING' ? -1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return paginate(dto, query);
}, ADMIN);

on('PATCH', '/api/v1/admin/users/:userId/status', ({ user, params, body }) => {
  const target = V.findUser(params.userId);
  if (!target) throw notfound('사용자를 찾을 수 없습니다.');
  if (target.userId === user.userId) throw conflict('INVALID_STATE', '본인 계정의 상태는 변경할 수 없습니다.');
  const allowed = ['ACTIVE', 'REJECTED', 'SUSPENDED'];
  const status = require_(body.status, 'status');
  if (!allowed.includes(status)) throw bad(`status 는 ${allowed.join(', ')} 중 하나여야 합니다.`, [{ field: 'status', reason: 'ENUM' }]);
  if (status === 'REJECTED' && !body.reason) throw bad('반려 사유를 입력해야 합니다.', [{ field: 'reason', reason: 'REQUIRED' }]);
  target.status = status;
  target.rejectReason = status === 'REJECTED' ? body.reason : null;
  target.approvedAt = status === 'ACTIVE' ? db.now() : null;
  target.approvedBy = user.userId;
  if (body.role && ['OPERATOR', 'ADMIN'].includes(body.role)) target.role = body.role;
  audit(user.userId, `USER_${status}`, 'USER', target.userId, `${target.name} → ${status}`);
  return V.userDto(target);
}, ADMIN);

on('GET', '/api/v1/admin/shipments', ({ query }) => {
  let list = db.shipments;
  if (query.status) list = list.filter(s => query.status.split(',').includes(s.status));
  if (query.companyId) list = list.filter(s => s.companyId === query.companyId);
  if (query.keyword) {
    const k = query.keyword.toLowerCase();
    list = list.filter(s => s.shipmentNo.toLowerCase().includes(k) || s.commodity.includes(query.keyword));
  }
  const dto = list.map(V.shipmentSummaryDto)
    .sort((a, b) => (a.status === 'PENDING_APPROVAL' ? -1 : 0) - (b.status === 'PENDING_APPROVAL' ? -1 : 0) || b.topRiskScore - a.topRiskScore);
  return paginate(dto, query);
}, ADMIN);

on('PATCH', '/api/v1/admin/shipments/:shipmentId/approval', ({ user, params, body }) => {
  const s = V.findShipment(params.shipmentId);
  if (!s) throw notfound('화물을 찾을 수 없습니다.');
  if (s.status !== 'PENDING_APPROVAL') throw conflict('INVALID_STATE', `승인 대기 상태의 화물만 처리할 수 있습니다. (현재: ${s.status})`);
  const decision = require_(body.decision, 'decision');
  if (!['APPROVE', 'REJECT'].includes(decision)) throw bad('decision 은 APPROVE 또는 REJECT 여야 합니다.', [{ field: 'decision', reason: 'ENUM' }]);
  if (decision === 'REJECT' && !body.reason) throw bad('반려 사유를 입력해야 합니다.', [{ field: 'reason', reason: 'REQUIRED' }]);
  if (decision === 'APPROVE') {
    s.status = s.voyageId ? 'IN_TRANSIT' : 'ACTIVE';
    s.approvedAt = db.now(); s.approvedBy = user.userId; s.rejectReason = null;
  } else {
    s.status = 'REJECTED'; s.rejectReason = body.reason;
  }
  recomputeMatches(db);
  audit(user.userId, `SHIPMENT_${decision}`, 'SHIPMENT', s.shipmentId, `${s.shipmentNo} ${decision === 'APPROVE' ? '승인' : '반려'}`);
  return V.shipmentDetailDto(s);
}, ADMIN);

on('GET', '/api/v1/admin/feeds', ({ query }) => {
  let list = db.rawFeeds;
  if (query.processStatus) list = list.filter(f => query.processStatus.split(',').includes(f.processStatus));
  if (query.sourceId) list = list.filter(f => f.sourceId === query.sourceId);
  const dto = list.map(V.feedDto).sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)));
  return paginate(dto, query);
}, ADMIN);

on('POST', '/api/v1/admin/feeds/:rawFeedId/analyze', ({ user, params }) => {
  const f = db.rawFeeds.find(x => x.rawFeedId === params.rawFeedId);
  if (!f) throw notfound('수집 원문을 찾을 수 없습니다.');
  const existing = db.riskEvents.find(e => e.rawFeedId === f.rawFeedId);
  if (existing) { existing.llmExtractedAt = db.now(); existing.status = existing.status === 'DISMISSED' ? 'DRAFT' : existing.status; }
  else {
    const e = { eventId: db.nextId('EV'), rawFeedId: f.rawFeedId, eventType: 'GEOPOLITICAL', status: 'DRAFT',
      title: f.title.slice(0, 60), summary: f.body.slice(0, 200) + '…',
      severity: 3, confidence: 0.6, startDate: f.publishedAt.slice(0, 10),
      expectedEndDate: new Date(Date.parse(f.publishedAt) + 30 * 86400000).toISOString().slice(0, 10),
      llmModel: 'claude-opus-5', llmExtractedAt: db.now(), reviewedBy: null, reviewedAt: null, reviewNote: null, publishedAt: null };
    db.riskEvents.push(e);
    f.processStatus = 'PROCESSED';
  }
  audit(user.userId, 'FEED_ANALYZE', 'RAW_FEED', f.rawFeedId, 'LLM 재분석 실행');
  return { status: 202, body: { rawFeedId: f.rawFeedId, message: 'LLM 정형화를 실행했습니다. 결과를 검토 후 발행하세요.', event: V.eventDetailDto(db.riskEvents.find(e => e.rawFeedId === f.rawFeedId)) } };
}, ADMIN);

on('GET', '/api/v1/admin/risk-events', ({ query }) => {
  let list = db.riskEvents;
  if (query.status) list = list.filter(e => query.status.split(',').includes(e.status));
  if (query.eventType) list = list.filter(e => query.eventType.split(',').includes(e.eventType));
  const order = { DRAFT: 0, PUBLISHED: 1, EXPIRED: 2, DISMISSED: 3 };
  const dto = list.map(e => ({ ...V.eventSummaryDto(e),
    sourceName: (() => { const f = db.rawFeeds.find(x => x.rawFeedId === e.rawFeedId); const s = f && db.riskSources.find(y => y.sourceId === f.sourceId); return s ? s.name : null; })(),
    trustWeight: (() => { const f = db.rawFeeds.find(x => x.rawFeedId === e.rawFeedId); const s = f && db.riskSources.find(y => y.sourceId === f.sourceId); return s ? s.trustWeight : null; })(),
    reviewerName: (V.findUser(e.reviewedBy) || {}).name || null, reviewedAt: e.reviewedAt, reviewNote: e.reviewNote,
    llmModel: e.llmModel, llmExtractedAt: e.llmExtractedAt }))
    .sort((a, b) => (order[a.status] - order[b.status]) || b.severity - a.severity);
  return paginate(dto, query);
}, ADMIN);

on('PATCH', '/api/v1/admin/risk-events/:eventId', ({ user, params, body }) => {
  const e = V.findEvent(params.eventId);
  if (!e) throw notfound('리스크 이벤트를 찾을 수 없습니다.');
  if (body.severity !== undefined) {
    const sev = Number(body.severity);
    if (!Number.isInteger(sev) || sev < 1 || sev > 5) throw bad('severity 는 1~5 사이 정수여야 합니다.', [{ field: 'severity', reason: 'RANGE' }]);
    e.severity = sev;
  }
  if (body.confidence !== undefined) {
    const c = Number(body.confidence);
    if (!(c >= 0 && c <= 1)) throw bad('confidence 는 0.0~1.0 사이여야 합니다.', [{ field: 'confidence', reason: 'RANGE' }]);
    e.confidence = c;
  }
  if (body.startDate && body.expectedEndDate && dayDiff(body.expectedEndDate, body.startDate) < 0)
    throw bad('종료 예상일이 시작일보다 빠릅니다.', [{ field: 'expectedEndDate', reason: 'BEFORE_START' }]);
  ['eventType', 'title', 'summary', 'startDate', 'expectedEndDate', 'reviewNote'].forEach(f => { if (body[f] !== undefined) e[f] = body[f]; });
  e.reviewedBy = user.userId; e.reviewedAt = db.now();
  recomputeMatches(db);
  audit(user.userId, 'EVENT_UPDATE', 'RISK_EVENT', e.eventId, '정형화 결과 수정');
  return V.eventDetailDto(e);
}, ADMIN);

on('PUT', '/api/v1/admin/risk-events/:eventId/areas', ({ user, params, body }) => {
  const e = V.findEvent(params.eventId);
  if (!e) throw notfound('리스크 이벤트를 찾을 수 없습니다.');
  const areas = body.areas;
  if (!Array.isArray(areas) || !areas.length) throw bad('영향 지역은 1개 이상이어야 합니다.', [{ field: 'areas', reason: 'MIN_ITEMS' }]);
  for (const a of areas) {
    if (!['PORT', 'CHOKEPOINT'].includes(a.areaType)) throw bad('areaType 은 PORT 또는 CHOKEPOINT 여야 합니다.', [{ field: 'areas[].areaType', reason: 'ENUM' }]);
    if (a.areaType === 'PORT' && !V.findPort(a.portId)) throw notfound(`존재하지 않는 항만입니다: ${a.portId}`);
    if (a.areaType === 'CHOKEPOINT' && !V.findChoke(a.chokePointId)) throw notfound(`존재하지 않는 요충지입니다: ${a.chokePointId}`);
  }
  db.eventAreas = db.eventAreas.filter(a => a.eventId !== e.eventId);
  areas.forEach(a => db.eventAreas.push({ eventAreaId: db.nextId('EA'), eventId: e.eventId, areaType: a.areaType,
    portId: a.areaType === 'PORT' ? a.portId : null, chokePointId: a.areaType === 'CHOKEPOINT' ? a.chokePointId : null,
    impactLevel: Number(a.impactLevel || e.severity), expectedDelayDays: Number(a.expectedDelayDays || 0),
    startDate: a.startDate || null, endDate: a.endDate || null }));
  recomputeMatches(db);
  audit(user.userId, 'EVENT_AREA_UPDATE', 'RISK_EVENT', e.eventId, `영향 지역 ${areas.length}건 재설정`);
  return V.eventDetailDto(e);
}, ADMIN);

on('PATCH', '/api/v1/admin/risk-events/:eventId/status', ({ user, params, body }) => {
  const e = V.findEvent(params.eventId);
  if (!e) throw notfound('리스크 이벤트를 찾을 수 없습니다.');
  const allowed = ['PUBLISHED', 'DRAFT', 'DISMISSED', 'EXPIRED'];
  const status = require_(body.status, 'status');
  if (!allowed.includes(status)) throw bad(`status 는 ${allowed.join(', ')} 중 하나여야 합니다.`, [{ field: 'status', reason: 'ENUM' }]);
  if (status === 'PUBLISHED' && !db.eventAreas.some(a => a.eventId === e.eventId))
    throw conflict('NO_IMPACT_AREA', '영향 지역이 지정되지 않은 이벤트는 발행할 수 없습니다.');
  if (status === 'DISMISSED' && !body.reviewNote) throw bad('기각 사유를 입력해야 합니다.', [{ field: 'reviewNote', reason: 'REQUIRED' }]);
  e.status = status;
  e.publishedAt = status === 'PUBLISHED' ? db.now() : null;
  e.reviewedBy = user.userId; e.reviewedAt = db.now();
  if (body.reviewNote) e.reviewNote = body.reviewNote;
  recomputeMatches(db);
  audit(user.userId, `EVENT_${status}`, 'RISK_EVENT', e.eventId, e.title);
  return V.eventDetailDto(e);
}, ADMIN);

on('POST', '/api/v1/admin/risk-events/:eventId/rematch', ({ user, params }) => {
  const e = V.findEvent(params.eventId);
  if (!e) throw notfound('리스크 이벤트를 찾을 수 없습니다.');
  const before = db.impactMatches.filter(m => m.eventId === e.eventId).length;
  recomputeMatches(db);
  const after = db.impactMatches.filter(m => m.eventId === e.eventId);
  audit(user.userId, 'EVENT_REMATCH', 'RISK_EVENT', e.eventId, `재매칭 ${before} → ${after.length}`);
  return { eventId: e.eventId, before, after: after.length, matches: after.sort((a, b) => b.riskScore - a.riskScore).map(V.matchSummaryDto) };
}, ADMIN);

on('GET', '/api/v1/admin/sources', () => ({
  items: db.riskSources.map(s => ({ ...s,
    feedCount: db.rawFeeds.filter(f => f.sourceId === s.sourceId).length,
    eventCount: db.riskEvents.filter(e => { const f = db.rawFeeds.find(x => x.rawFeedId === e.rawFeedId); return f && f.sourceId === s.sourceId; }).length,
    lastJob: db.collectionJobs.find(j => j.sourceId === s.sourceId) || null })),
  total: db.riskSources.length
}), ADMIN);

on('POST', '/api/v1/admin/sources', ({ user, body }) => {
  ['name', 'sourceType', 'url'].forEach(f => require_(body[f], f));
  const tw = Number(body.trustWeight ?? 0.8);
  if (!(tw >= 0 && tw <= 1)) throw bad('trustWeight 는 0.0~1.0 사이여야 합니다.', [{ field: 'trustWeight', reason: 'RANGE' }]);
  if (db.riskSources.some(s => s.url === body.url)) throw conflict('DUPLICATE_SOURCE', '이미 등록된 URL 입니다.');
  const s = { sourceId: db.nextId('SRC'), name: body.name, sourceType: body.sourceType, url: body.url,
    language: body.language || 'en', trustWeight: tw, collectIntervalMin: Number(body.collectIntervalMin || 60),
    enabled: body.enabled !== false, lastCollectedAt: null };
  db.riskSources.push(s);
  audit(user.userId, 'SOURCE_CREATE', 'RISK_SOURCE', s.sourceId, s.name);
  return { status: 201, body: s };
}, ADMIN);

on('PATCH', '/api/v1/admin/sources/:sourceId', ({ user, params, body }) => {
  const s = db.riskSources.find(x => x.sourceId === params.sourceId);
  if (!s) throw notfound('수집 소스를 찾을 수 없습니다.');
  if (body.trustWeight !== undefined) {
    const tw = Number(body.trustWeight);
    if (!(tw >= 0 && tw <= 1)) throw bad('trustWeight 는 0.0~1.0 사이여야 합니다.', [{ field: 'trustWeight', reason: 'RANGE' }]);
    s.trustWeight = tw;
  }
  ['name', 'sourceType', 'url', 'language', 'collectIntervalMin', 'enabled'].forEach(f => { if (body[f] !== undefined) s[f] = body[f]; });
  recomputeMatches(db);
  audit(user.userId, body.enabled === false ? 'SOURCE_DISABLE' : 'SOURCE_UPDATE', 'RISK_SOURCE', s.sourceId, s.name);
  return s;
}, ADMIN);

on('GET', '/api/v1/admin/thresholds', () => ({ items: db.riskThresholds, total: db.riskThresholds.length }), ADMIN);

on('PUT', '/api/v1/admin/thresholds', ({ user, body }) => {
  const items = body.items;
  if (!Array.isArray(items) || items.length !== 4) throw bad('4개 등급(LOW/MEDIUM/HIGH/CRITICAL)을 모두 전송해야 합니다.', [{ field: 'items', reason: 'LENGTH' }]);
  const sorted = [...items].sort((a, b) => a.minScore - b.minScore);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.minScore < 0 || t.maxScore > 100 || t.minScore > t.maxScore)
      throw bad(`${t.grade} 등급의 점수 구간이 올바르지 않습니다.`, [{ field: `items[${i}]`, reason: 'RANGE' }]);
    if (i > 0 && sorted[i - 1].maxScore + 1 !== t.minScore)
      throw bad(`${sorted[i - 1].grade} 와 ${t.grade} 구간이 연속되지 않습니다.`, [{ field: `items[${i}].minScore`, reason: 'NOT_CONTIGUOUS' }]);
  }
  db.riskThresholds = items.map(t => ({ grade: t.grade, minScore: Number(t.minScore), maxScore: Number(t.maxScore),
    color: t.color || '#888', notifyEnabled: !!t.notifyEnabled, requiresApproval: !!t.requiresApproval,
    updatedBy: user.userId, updatedAt: db.now() }));
  recomputeMatches(db);
  audit(user.userId, 'THRESHOLD_UPDATE', 'RISK_THRESHOLD', '-', '등급 기준 변경');
  return { items: db.riskThresholds, total: db.riskThresholds.length };
}, ADMIN);

on('GET', '/api/v1/admin/notifications', ({ query }) => {
  let list = db.notifications;
  if (query.status) list = list.filter(n => query.status.split(',').includes(n.status));
  if (query.scope) list = list.filter(n => n.scope === query.scope);
  const dto = list.map(V.notificationDto)
    .sort((a, b) => (a.status === 'PENDING_APPROVAL' ? -1 : 0) - (b.status === 'PENDING_APPROVAL' ? -1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return paginate(dto, query);
}, ADMIN);

on('PATCH', '/api/v1/admin/notifications/:notificationId/approval', ({ user, params, body }) => {
  const n = db.notifications.find(x => x.notificationId === params.notificationId);
  if (!n) throw notfound('알림을 찾을 수 없습니다.');
  if (n.status !== 'PENDING_APPROVAL') throw conflict('INVALID_STATE', `승인 대기 상태의 알림만 처리할 수 있습니다. (현재: ${n.status})`);
  const decision = require_(body.decision, 'decision');
  if (!['APPROVE', 'REJECT'].includes(decision)) throw bad('decision 은 APPROVE 또는 REJECT 여야 합니다.', [{ field: 'decision', reason: 'ENUM' }]);
  if (decision === 'REJECT' && !body.reason) throw bad('반려 사유를 입력해야 합니다.', [{ field: 'reason', reason: 'REQUIRED' }]);
  n.approvedBy = user.userId; n.approvedAt = db.now();
  if (decision === 'APPROVE') { n.status = 'SENT'; n.sentAt = db.now(); }
  else { n.status = 'REJECTED'; n.failReason = body.reason; }
  audit(user.userId, `NOTIFICATION_${decision}`, 'NOTIFICATION', n.notificationId, n.title);
  return V.notificationDto(n);
}, ADMIN);

on('GET', '/api/v1/admin/feedback-summary', () => {
  const fb = db.matchFeedbacks;
  const byEvent = {};
  fb.forEach(f => {
    const m = V.findMatch(f.matchId); if (!m) return;
    const b = (byEvent[m.eventId] = byEvent[m.eventId] || { eventId: m.eventId, eventTitle: (V.findEvent(m.eventId) || {}).title, total: 0, falsePositive: 0 });
    b.total++; if (!f.isRelevant) b.falsePositive++;
  });
  return {
    total: fb.length,
    relevant: fb.filter(f => f.isRelevant).length,
    falsePositive: fb.filter(f => !f.isRelevant).length,
    precision: fb.length ? Number((fb.filter(f => f.isRelevant).length / fb.length).toFixed(3)) : null,
    avgActualDelayDays: (() => { const v = fb.filter(f => f.actualDelayDays != null).map(f => f.actualDelayDays); return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)) : null; })(),
    byEvent: Object.values(byEvent),
    items: fb.map(V.feedbackDto)
  };
}, ADMIN);

on('GET', '/api/v1/admin/audit-logs', ({ query }) => {
  let list = db.auditLogs;
  if (query.action) list = list.filter(a => a.action.includes(query.action));
  if (query.targetType) list = list.filter(a => a.targetType === query.targetType);
  return paginate(list.map(a => ({ ...a, actorName: (V.findUser(a.actorUserId) || {}).name || a.actorUserId })), query);
}, ADMIN);

on('GET', '/api/v1/admin/collection-jobs', ({ query }) => {
  const list = db.collectionJobs.map(j => ({ ...j, sourceName: (db.riskSources.find(s => s.sourceId === j.sourceId) || {}).name }));
  return paginate(list, query);
}, ADMIN);
