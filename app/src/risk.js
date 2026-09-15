// SONAR - 리스크 매칭 엔진 (FR-03) 및 리스크 점수 산출 (FR-04)

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(v) { return v ? new Date(v + (String(v).length === 10 ? 'T00:00:00Z' : '')) : null; }
export function dayDiff(a, b) { return Math.round((toDate(a) - toDate(b)) / DAY_MS); }
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
export function inWindow(d, start, end) {
  if (!d) return false;
  const t = toDate(d).getTime();
  return t >= toDate(start).getTime() && t <= toDate(end).getTime();
}
export function maxDate(a, b) { return toDate(a) > toDate(b) ? a : b; }
export function minDate(a, b) { return toDate(a) < toDate(b) ? a : b; }

export const DEFAULT_THRESHOLDS = [
  { grade: 'LOW',      minScore: 0,  maxScore: 24,  color: '#e8edf4', notifyEnabled: false, requiresApproval: false },
  { grade: 'MEDIUM',   minScore: 25, maxScore: 49,  color: '#ffd166', notifyEnabled: true,  requiresApproval: false },
  { grade: 'HIGH',     minScore: 50, maxScore: 74,  color: '#ff8a3d', notifyEnabled: true,  requiresApproval: true  },
  { grade: 'CRITICAL', minScore: 75, maxScore: 100, color: '#ff2f45', notifyEnabled: true,  requiresApproval: true  }
];

export const GRADE_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function gradeOfScore(score, thresholds = DEFAULT_THRESHOLDS) {
  const hit = thresholds.find(t => score >= t.minScore && score <= t.maxScore);
  return hit ? hit.grade : 'LOW';
}

// 노출도(Exposure) = 화물 가액 + 납기 여유 + 대체경로 유무
export function computeExposure(shipment) {
  const valueNorm = clamp((shipment.cargoValueUsd || 0) / 2000000, 0, 1);
  const bufferDays = shipment.customerDueDate && shipment.eta
    ? dayDiff(shipment.customerDueDate, shipment.eta) : 21;
  const urgency = 1 - clamp(bufferDays / 21, 0, 1);
  const routeRigidity = shipment.alternativeRouteAvailable ? 0.35 : 1.0;
  // 가중합(0~1)을 0.4~1.0 구간으로 사상한다. 노출도가 0에 수렴해 점수가 붕괴하는 것을 막기 위함.
  const weighted = 0.35 * valueNorm + 0.40 * urgency + 0.25 * routeRigidity;
  const exposure = 0.4 + 0.6 * weighted;
  return {
    exposureFactor: Number(exposure.toFixed(4)),
    bufferDays,
    detail: {
      valueNorm: Number(valueNorm.toFixed(4)),
      urgency: Number(urgency.toFixed(4)),
      routeRigidity: Number(routeRigidity.toFixed(4)),
      weighted: Number(weighted.toFixed(4))
    }
  };
}

// 리스크 점수 = 심각도 × 노출도 × 신뢰도  (0 ~ 100)
export function computeRiskScore({ event, area, shipment, trustWeight = 1, thresholds }) {
  const severityFactor = (event.severity / 5) * 0.7 + ((area.impactLevel || event.severity) / 5) * 0.3;
  const { exposureFactor, bufferDays, detail } = computeExposure(shipment);
  const confidenceFactor = clamp((event.confidence || 0.5) * trustWeight, 0, 1);
  const raw = 100 * severityFactor * exposureFactor * confidenceFactor;
  const riskScore = Math.round(clamp(raw, 0, 100));
  return {
    riskScore,
    riskGrade: gradeOfScore(riskScore, thresholds),
    severityFactor: Number(severityFactor.toFixed(4)),
    exposureFactor,
    confidenceFactor: Number(confidenceFactor.toFixed(4)),
    bufferDays,
    exposureDetail: detail
  };
}

// 이벤트 영향지역 × 화물 운송구간 × 일정 겹침 → 영향 건 산출
function findHits(area, shipment, voyage) {
  const hits = [];
  if (area.areaType === 'PORT') {
    if (shipment.originPortId === area.portId && inWindow(shipment.etd, area.startDate, area.endDate))
      hits.push({ matchReason: 'ORIGIN', exposureDate: shipment.etd, portId: area.portId });
    if (shipment.destinationPortId === area.portId && inWindow(shipment.eta, area.startDate, area.endDate))
      hits.push({ matchReason: 'DESTINATION', exposureDate: shipment.eta, portId: area.portId });
    if (voyage) {
      for (const leg of voyage.legs) {
        if (leg.portId !== area.portId) continue;
        if (leg.portId === shipment.originPortId || leg.portId === shipment.destinationPortId) continue;
        if (inWindow(leg.eta, area.startDate, area.endDate))
          hits.push({ matchReason: 'PORT_CALL', exposureDate: leg.eta, portId: area.portId });
      }
    }
  } else if (area.areaType === 'CHOKEPOINT') {
    for (const rp of shipment.routePoints || []) {
      if (rp.chokePointId !== area.chokePointId) continue;
      if (inWindow(rp.expectedPassageDate, area.startDate, area.endDate))
        hits.push({ matchReason: 'CHOKEPOINT_TRANSIT', exposureDate: rp.expectedPassageDate, chokePointId: area.chokePointId });
    }
  }
  return hits;
}

const MATCHABLE_SHIPMENT_STATUS = ['ACTIVE', 'IN_TRANSIT', 'PENDING_APPROVAL'];

/**
 * 전체 재매칭. 기존 match 의 사용자 상태(status/조치/피드백)는 보존한다.
 */
export function recomputeMatches(db) {
  const prev = new Map(db.impactMatches.map(m => [m.eventId + '|' + m.shipmentId, m]));
  const next = [];
  const publishedEvents = db.riskEvents.filter(e => e.status === 'PUBLISHED');

  for (const event of publishedEvents) {
    const feed = db.rawFeeds.find(f => f.rawFeedId === event.rawFeedId);
    const source = feed ? db.riskSources.find(s => s.sourceId === feed.sourceId) : null;
    const trustWeight = source ? source.trustWeight : 0.8;
    const areas = db.eventAreas.filter(a => a.eventId === event.eventId)
      .map(a => ({ ...a, startDate: a.startDate || event.startDate, endDate: a.endDate || event.expectedEndDate }));

    for (const shipment of db.shipments) {
      if (!MATCHABLE_SHIPMENT_STATUS.includes(shipment.status)) continue;
      const voyage = db.voyages.find(v => v.voyageId === shipment.voyageId);

      let best = null;
      for (const area of areas) {
        for (const hit of findHits(area, shipment, voyage)) {
          const scored = computeRiskScore({ event, area, shipment, trustWeight, thresholds: db.riskThresholds });
          const cand = { area, hit, scored };
          if (!best || cand.scored.riskScore > best.scored.riskScore) best = cand;
        }
      }
      if (!best) continue;

      const key = event.eventId + '|' + shipment.shipmentId;
      const old = prev.get(key);
      const overlapStart = maxDate(shipment.etd, best.area.startDate);
      const overlapEnd = minDate(shipment.eta, best.area.endDate);

      next.push({
        matchId: old ? old.matchId : db.nextId('MT'),
        eventId: event.eventId,
        shipmentId: shipment.shipmentId,
        companyId: shipment.companyId,
        eventAreaId: best.area.eventAreaId,
        matchReason: best.hit.matchReason,
        exposureDate: best.hit.exposureDate,
        overlapStart, overlapEnd,
        expectedDelayDays: best.area.expectedDelayDays,
        riskScore: best.scored.riskScore,
        riskGrade: best.scored.riskGrade,
        severityFactor: best.scored.severityFactor,
        exposureFactor: best.scored.exposureFactor,
        confidenceFactor: best.scored.confidenceFactor,
        bufferDays: best.scored.bufferDays,
        exposureDetail: best.scored.exposureDetail,
        provisional: shipment.status === 'PENDING_APPROVAL',
        status: old ? old.status : 'OPEN',
        createdAt: old ? old.createdAt : db.now(),
        updatedAt: db.now()
      });
    }
  }
  db.impactMatches = next;
  return next;
}
