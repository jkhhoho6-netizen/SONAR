// SONAR - 응답 DTO 조립 (엔터티 → API 스키마)
import db from './db.js';
import { GRADE_ORDER } from './risk.js';

export const findPort   = id => db.ports.find(p => p.portId === id) || null;
export const findChoke  = id => db.chokePoints.find(c => c.chokePointId === id) || null;
export const findVoyage = id => db.voyages.find(v => v.voyageId === id) || null;
export const findVessel = id => db.vessels.find(v => v.vesselId === id) || null;
export const findUser   = id => db.users.find(u => u.userId === id) || null;
export const findCompany= id => db.companies.find(c => c.companyId === id) || null;
export const findEvent  = id => db.riskEvents.find(e => e.eventId === id) || null;
export const findArea   = id => db.eventAreas.find(a => a.eventAreaId === id) || null;
export const findShipment = id => db.shipments.find(s => s.shipmentId === id) || null;
export const findMatch  = id => db.impactMatches.find(m => m.matchId === id) || null;

export const portRef = id => {
  const p = findPort(id);
  return p ? { portId: p.portId, unlocode: p.unlocode, nameKo: p.nameKo, nameEn: p.nameEn, countryCode: p.countryCode, lat: p.lat, lon: p.lon } : null;
};
export const chokeRef = id => {
  const c = findChoke(id);
  return c ? { chokePointId: c.chokePointId, code: c.code, nameKo: c.nameKo, nameEn: c.nameEn, lat: c.lat, lon: c.lon, radiusKm: c.radiusKm } : null;
};

export function userDto(u) {
  if (!u) return null;
  const c = findCompany(u.companyId);
  return { userId:u.userId, email:u.email, name:u.name, phone:u.phone, role:u.role, status:u.status,
    department:u.department, companyId:u.companyId, companyName:c ? c.name : null, companyType:c ? c.companyType : null,
    createdAt:u.createdAt, approvedAt:u.approvedAt, lastLoginAt:u.lastLoginAt, rejectReason:u.rejectReason || null };
}

export function vesselDto(voyage) {
  if (!voyage) return null;
  const vs = findVessel(voyage.vesselId);
  const carrier = vs ? db.carriers.find(c => c.carrierId === vs.carrierId) : null;
  return { voyageId:voyage.voyageId, voyageNo:voyage.voyageNo, serviceRouteName:voyage.serviceRouteName, status:voyage.status,
    vesselId:vs && vs.vesselId, vesselName:vs && vs.name, imoNo:vs && vs.imoNo,
    carrierName:carrier && carrier.name, capacityTeu:vs && vs.capacityTeu,
    currentLat:voyage.currentLat, currentLon:voyage.currentLon, currentSpeedKn:voyage.currentSpeedKn,
    currentHeading:voyage.currentHeading, positionUpdatedAt:voyage.positionUpdatedAt };
}

export function voyageWaypoints(voyage) {
  if (!voyage) return [];
  const pts = [];
  for (const leg of voyage.legs) {
    const p = findPort(leg.portId);
    if (p) pts.push({ kind:'PORT', name:p.nameKo, lat:p.lat, lon:p.lon, date: leg.etd || leg.eta });
  }
  for (const t of voyage.transits) {
    const c = findChoke(t.chokePointId);
    if (c) pts.push({ kind:'CHOKEPOINT', name:c.nameKo, lat:c.lat, lon:c.lon, date:t.expectedPassageDate });
  }
  return pts.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function shipmentRiskSummary(shipmentId) {
  const ms = db.impactMatches.filter(m => m.shipmentId === shipmentId && m.status !== 'FALSE_POSITIVE');
  if (!ms.length) return { topRiskScore: 0, topRiskGrade: 'NONE', openMatchCount: 0, maxExpectedDelayDays: 0 };
  const top = ms.reduce((a, b) => (b.riskScore > a.riskScore ? b : a));
  return {
    topRiskScore: top.riskScore,
    topRiskGrade: top.riskGrade,
    openMatchCount: ms.filter(m => m.status === 'OPEN').length,
    matchCount: ms.length,
    maxExpectedDelayDays: Math.max(...ms.map(m => m.expectedDelayDays || 0))
  };
}

export function shipmentSummaryDto(s) {
  const risk = shipmentRiskSummary(s.shipmentId);
  const v = findVoyage(s.voyageId);
  return {
    shipmentId:s.shipmentId, shipmentNo:s.shipmentNo, companyId:s.companyId,
    companyName:(findCompany(s.companyId) || {}).name,
    ownerUserId:s.ownerUserId, ownerName:(findUser(s.ownerUserId) || {}).name,
    commodity:s.commodity, cargoValueUsd:s.cargoValueUsd, currency:s.currency,
    customerName:s.customerName, containerType:s.containerType, containerCount:s.containerCount,
    originPort:portRef(s.originPortId), destinationPort:portRef(s.destinationPortId),
    etd:s.etd, eta:s.eta, customerDueDate:s.customerDueDate,
    alternativeRouteAvailable:s.alternativeRouteAvailable,
    status:s.status, vessel:vesselDto(v), createdAt:s.createdAt, ...risk
  };
}

export function shipmentDetailDto(s) {
  const v = findVoyage(s.voyageId);
  return {
    ...shipmentSummaryDto(s),
    incoterms:s.incoterms, containerNo:s.containerNo, weightKg:s.weightKg,
    memo:s.memo, rejectReason:s.rejectReason,
    approvedAt:s.approvedAt, approvedBy:s.approvedBy,
    approverName:(findUser(s.approvedBy) || {}).name || null,
    routePoints:(s.routePoints || []).map(rp => ({ seq:rp.seq, expectedPassageDate:rp.expectedPassageDate, chokePoint:chokeRef(rp.chokePointId) })),
    schedule:v ? v.legs.map(l => ({ seq:l.seq, port:portRef(l.portId), eta:l.eta || null, etd:l.etd || null })) : [],
    waypoints:voyageWaypoints(v),
    matches: db.impactMatches.filter(m => m.shipmentId === s.shipmentId)
      .sort((a, b) => b.riskScore - a.riskScore).map(matchSummaryDto)
  };
}

export function eventAreaDto(a) {
  return { eventAreaId:a.eventAreaId, eventId:a.eventId, areaType:a.areaType,
    port:a.portId ? portRef(a.portId) : null, chokePoint:a.chokePointId ? chokeRef(a.chokePointId) : null,
    areaName:a.portId ? (findPort(a.portId) || {}).nameKo : (findChoke(a.chokePointId) || {}).nameKo,
    impactLevel:a.impactLevel, expectedDelayDays:a.expectedDelayDays,
    startDate:a.startDate, endDate:a.endDate };
}

export function eventSummaryDto(e) {
  const areas = db.eventAreas.filter(a => a.eventId === e.eventId);
  const ms = db.impactMatches.filter(m => m.eventId === e.eventId);
  const topGrade = ms.length ? ms.map(m => m.riskGrade).sort((a, b) => GRADE_ORDER[b] - GRADE_ORDER[a])[0] : 'NONE';
  return { eventId:e.eventId, eventType:e.eventType, status:e.status, title:e.title, summary:e.summary,
    severity:e.severity, confidence:e.confidence, startDate:e.startDate, expectedEndDate:e.expectedEndDate,
    publishedAt:e.publishedAt, areaCount:areas.length,
    areaNames:areas.map(a => a.portId ? (findPort(a.portId) || {}).nameKo : (findChoke(a.chokePointId) || {}).nameKo),
    impactedShipmentCount:ms.length, topRiskGrade:topGrade };
}

export function eventDetailDto(e, { companyId } = {}) {
  const feed = db.rawFeeds.find(f => f.rawFeedId === e.rawFeedId) || null;
  const source = feed ? db.riskSources.find(s => s.sourceId === feed.sourceId) : null;
  let ms = db.impactMatches.filter(m => m.eventId === e.eventId);
  if (companyId) ms = ms.filter(m => m.companyId === companyId);
  return { ...eventSummaryDto(e),
    llmModel:e.llmModel, llmExtractedAt:e.llmExtractedAt,
    reviewedBy:e.reviewedBy, reviewerName:(findUser(e.reviewedBy) || {}).name || null,
    reviewedAt:e.reviewedAt, reviewNote:e.reviewNote,
    areas:db.eventAreas.filter(a => a.eventId === e.eventId).map(eventAreaDto),
    source:feed ? { rawFeedId:feed.rawFeedId, sourceId:feed.sourceId, sourceName:source ? source.name : null,
      sourceType:source ? source.sourceType : null, trustWeight:source ? source.trustWeight : null,
      title:feed.title, body:feed.body, url:feed.url, publishedAt:feed.publishedAt, collectedAt:feed.collectedAt } : null,
    matches:ms.sort((a, b) => b.riskScore - a.riskScore).map(matchSummaryDto) };
}

export function matchSummaryDto(m) {
  const s = findShipment(m.shipmentId);
  const e = findEvent(m.eventId);
  const v = s ? findVoyage(s.voyageId) : null;
  const area = findArea(m.eventAreaId);
  return {
    matchId:m.matchId, eventId:m.eventId, shipmentId:m.shipmentId, companyId:m.companyId,
    eventTitle:e && e.title, eventType:e && e.eventType, eventSeverity:e && e.severity,
    shipmentNo:s && s.shipmentNo, commodity:s && s.commodity, cargoValueUsd:s && s.cargoValueUsd,
    ownerUserId:s && s.ownerUserId, ownerName:s ? (findUser(s.ownerUserId) || {}).name : null,
    companyName:s ? (findCompany(s.companyId) || {}).name : null,
    originPort:s && portRef(s.originPortId), destinationPort:s && portRef(s.destinationPortId),
    vesselName:v ? (findVessel(v.vesselId) || {}).name : null,
    areaName:area ? (area.portId ? (findPort(area.portId) || {}).nameKo : (findChoke(area.chokePointId) || {}).nameKo) : null,
    matchReason:m.matchReason, exposureDate:m.exposureDate, overlapStart:m.overlapStart, overlapEnd:m.overlapEnd,
    expectedDelayDays:m.expectedDelayDays, bufferDays:m.bufferDays,
    riskScore:m.riskScore, riskGrade:m.riskGrade, provisional:m.provisional,
    status:m.status, eta:s && s.eta, customerDueDate:s && s.customerDueDate,
    createdAt:m.createdAt, updatedAt:m.updatedAt
  };
}

export function matchDetailDto(m) {
  const s = findShipment(m.shipmentId);
  const e = findEvent(m.eventId);
  return { ...matchSummaryDto(m),
    scoreBreakdown:{
      formula:'riskScore = 100 × severityFactor × exposureFactor × confidenceFactor',
      severityFactor:m.severityFactor, exposureFactor:m.exposureFactor, confidenceFactor:m.confidenceFactor,
      exposureDetail:m.exposureDetail,
      severityRaw:e && e.severity, confidenceRaw:e && e.confidence },
    event:e ? eventSummaryDto(e) : null,
    shipment:s ? shipmentSummaryDto(s) : null,
    area:findArea(m.eventAreaId) ? eventAreaDto(findArea(m.eventAreaId)) : null,
    actions:db.actionLogs.filter(a => a.matchId === m.matchId).map(actionDto),
    feedback:db.matchFeedbacks.filter(f => f.matchId === m.matchId).map(feedbackDto)
  };
}

export const actionDto = a => ({ actionId:a.actionId, matchId:a.matchId, playbookId:a.playbookId,
  playbookTitle:(db.responsePlaybooks.find(p => p.playbookId === a.playbookId) || {}).title || null,
  userId:a.userId, userName:(findUser(a.userId) || {}).name || null,
  actionType:a.actionType, content:a.content, result:a.result, resultNote:a.resultNote,
  actedAt:a.actedAt, createdAt:a.createdAt });

export const feedbackDto = f => ({ feedbackId:f.feedbackId, matchId:f.matchId, userId:f.userId,
  userName:(findUser(f.userId) || {}).name || null, isRelevant:f.isRelevant,
  actualDelayDays:f.actualDelayDays, comment:f.comment, createdAt:f.createdAt });

export const notificationDto = n => ({ notificationId:n.notificationId, matchId:n.matchId, eventId:n.eventId,
  shipmentId:n.shipmentId, shipmentNo:(findShipment(n.shipmentId) || {}).shipmentNo || null,
  recipientUserId:n.recipientUserId, recipientName:(findUser(n.recipientUserId) || {}).name || null,
  channel:n.channel, scope:n.scope, title:n.title, message:n.message, status:n.status,
  requestedBy:n.requestedBy, requesterName:(findUser(n.requestedBy) || {}).name || null,
  approvedBy:n.approvedBy, approverName:(findUser(n.approvedBy) || {}).name || null,
  approvedAt:n.approvedAt, sentAt:n.sentAt, readAt:n.readAt, failReason:n.failReason, createdAt:n.createdAt });

export const feedDto = f => {
  const s = db.riskSources.find(x => x.sourceId === f.sourceId);
  const ev = db.riskEvents.find(e => e.rawFeedId === f.rawFeedId);
  return { rawFeedId:f.rawFeedId, sourceId:f.sourceId, sourceName:s ? s.name : null, sourceType:s ? s.sourceType : null,
    trustWeight:s ? s.trustWeight : null, externalId:f.externalId, title:f.title, body:f.body, url:f.url,
    publishedAt:f.publishedAt, collectedAt:f.collectedAt, processStatus:f.processStatus, discardReason:f.discardReason || null,
    eventId:ev ? ev.eventId : null, eventStatus:ev ? ev.status : null, eventTitle:ev ? ev.title : null };
};
