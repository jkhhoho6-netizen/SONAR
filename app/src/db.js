// SONAR - 인메모리 저장소 (프로토타입). 운영 구현 시 RDB + ORM 으로 대체된다.
import { ports, chokePoints, carriers, responsePlaybooks } from './master.js';
import { vessels, voyages, shipments, linkRoutePoints } from './seed-fleet.js';
import { riskSources, rawFeeds, riskEvents, eventAreas } from './seed-risk.js';
import { recomputeMatches, DEFAULT_THRESHOLDS } from './risk.js';

const counters = {};

export const db = {
  // --- 기준/마스터 ---
  ports, chokePoints, carriers, responsePlaybooks, vessels, voyages,

  // --- 테넌트/사용자 ---
  companies: [
    { companyId:'C000', name:'SONAR 운영본부',        bizRegNo:'000-00-00000', companyType:'PLATFORM',  createdAt:'2026-01-02T00:00:00Z' },
    { companyId:'C001', name:'(주)한신머티리얼즈',      bizRegNo:'214-81-33210', companyType:'SHIPPER',   createdAt:'2026-02-11T00:00:00Z' },
    { companyId:'C002', name:'대륙로지스틱스(주)',      bizRegNo:'106-86-51902', companyType:'FORWARDER', createdAt:'2026-03-04T00:00:00Z' },
    { companyId:'C003', name:'(주)세아정밀',           bizRegNo:'502-81-77431', companyType:'SHIPPER',   createdAt:'2026-09-13T00:00:00Z' }
  ],
  users: [
    { userId:'U001', companyId:'C000', email:'admin@sonar.io',        password:'sonar1234', name:'박시윤', phone:'010-2841-7720', role:'ADMIN',    status:'ACTIVE',   department:'플랫폼 운영팀', createdAt:'2026-01-02T00:00:00Z', approvedAt:'2026-01-02T00:00:00Z', approvedBy:null,   lastLoginAt:'2026-09-15T01:10:00Z' },
    { userId:'U002', companyId:'C001', email:'operator@sonar.io',     password:'sonar1234', name:'김도현', phone:'010-3391-2048', role:'OPERATOR', status:'ACTIVE',   department:'글로벌물류팀',   createdAt:'2026-02-11T00:00:00Z', approvedAt:'2026-02-11T04:00:00Z', approvedBy:'U001', lastLoginAt:'2026-09-15T00:40:00Z' },
    { userId:'U003', companyId:'C001', email:'lee@hanshin.co.kr',     password:'sonar1234', name:'이서연', phone:'010-7712-9931', role:'OPERATOR', status:'ACTIVE',   department:'글로벌물류팀',   createdAt:'2026-02-14T00:00:00Z', approvedAt:'2026-02-14T02:00:00Z', approvedBy:'U001', lastLoginAt:'2026-09-14T08:20:00Z' },
    { userId:'U004', companyId:'C002', email:'choi@daeryuk.co.kr',    password:'sonar1234', name:'최민준', phone:'010-5520-3318', role:'OPERATOR', status:'ACTIVE',   department:'해상영업1팀',    createdAt:'2026-03-04T00:00:00Z', approvedAt:'2026-03-04T06:00:00Z', approvedBy:'U001', lastLoginAt:'2026-09-14T23:55:00Z' },
    { userId:'U005', companyId:'C003', email:'park@seah.co.kr',       password:'sonar1234', name:'박지호', phone:'010-2204-6671', role:'OPERATOR', status:'PENDING',  department:'수출팀',        createdAt:'2026-09-13T05:40:00Z', approvedAt:null, approvedBy:null, lastLoginAt:null },
    { userId:'U006', companyId:'C002', email:'jung@daeryuk.co.kr',    password:'sonar1234', name:'정하은', phone:'010-6613-8802', role:'OPERATOR', status:'PENDING',  department:'해상영업2팀',    createdAt:'2026-09-14T07:15:00Z', approvedAt:null, approvedBy:null, lastLoginAt:null },
    { userId:'U007', companyId:'C001', email:'kang@hanshin.co.kr',    password:'sonar1234', name:'강태윤', phone:'010-9902-1143', role:'OPERATOR', status:'REJECTED', department:'생산관리팀',     createdAt:'2026-09-09T02:30:00Z', approvedAt:null, approvedBy:'U001', lastLoginAt:null, rejectReason:'물류 담당 부서가 아니어서 반려되었습니다. 부서 변경 후 재신청 바랍니다.' }
  ],

  // --- 리스크 파이프라인 ---
  riskSources, rawFeeds, riskEvents, eventAreas,
  shipments,
  impactMatches: [],
  actionLogs: [
    { actionId:'AC01', matchId:null, shipmentId:'SH001', playbookId:'PB02', userId:'U002', actionType:'INSURANCE_CLAIM',
      content:'바브엘만데브 통과 구간 전쟁위험 특약 부보 확대 신청 (부보액 1,450,000 USD, 요율 0.42%).',
      result:'DONE', resultNote:'삼성화재 승인 완료, 증권번호 MC-2026-118842.',
      actedAt:'2026-09-13T02:30:00Z', createdAt:'2026-09-13T02:30:00Z' },
    { actionId:'AC02', matchId:null, shipmentId:'SH005', playbookId:'PB03', userId:'U003', actionType:'NOTIFY_CUSTOMER',
      content:'KUKA 측에 홍해 리스크로 인한 ETA 변동 가능성 사전 고지 및 납기 유예 요청.',
      result:'IN_PROGRESS', resultNote:'고객 회신 대기 중 (담당: M. Bauer).',
      actedAt:'2026-09-14T06:10:00Z', createdAt:'2026-09-14T06:10:00Z' }
  ],
  matchFeedbacks: [
    { feedbackId:'FB01', matchId:null, shipmentId:'SH011', userId:'U004', isRelevant:false, actualDelayDays:0,
      comment:'파나마 운하 슬롯 사전 예약분이라 실제 대기 없이 통과했습니다. 예약 여부를 매칭 조건에 반영 필요.',
      createdAt:'2026-09-14T01:20:00Z' }
  ],
  notifications: [
    { notificationId:'NT01', matchId:null, eventId:'EV02', shipmentId:'SH001', recipientUserId:'U002', channel:'ALIMTALK', scope:'INTERNAL',
      title:'[CRITICAL] SNR-2026-0001 바브엘만데브 통과 예정',
      message:'담당 화물 SNR-2026-0001(HMM ALGECIRAS)이 09/16 바브엘만데브 해협을 통과할 예정입니다. 리스크 점수 76점.',
      status:'SENT', requestedBy:'SYSTEM', approvedBy:null, approvedAt:null, sentAt:'2026-09-14T22:00:00Z', readAt:null, failReason:null, createdAt:'2026-09-14T22:00:00Z' },
    { notificationId:'NT02', matchId:null, eventId:'EV03', shipmentId:'SH003', recipientUserId:'U002', channel:'IN_APP', scope:'INTERNAL',
      title:'[MEDIUM] SNR-2026-0003 상하이 출항 지연 가능',
      message:'태풍 너구리로 상하이항이 09/16 18시부터 폐쇄 예정입니다. 출항 예정일 09/17 영향 가능.',
      status:'SENT', requestedBy:'SYSTEM', approvedBy:null, approvedAt:null, sentAt:'2026-09-14T22:05:00Z', readAt:'2026-09-15T00:41:00Z', failReason:null, createdAt:'2026-09-14T22:05:00Z' },
    { notificationId:'NT03', matchId:null, eventId:'EV02', shipmentId:'SH009', recipientUserId:'U004', channel:'ALIMTALK', scope:'EXTERNAL',
      title:'[대외] C&A Europe 납기 지연 사전 고지',
      message:'홍해 항로 리스크로 SNR-2026-0009 도착 예정일이 10/06 → 10/18로 변경될 수 있음을 고객사에 안내합니다.',
      status:'PENDING_APPROVAL', requestedBy:'U004', approvedBy:null, approvedAt:null, sentAt:null, readAt:null, failReason:null, createdAt:'2026-09-15T02:12:00Z' },
    { notificationId:'NT04', matchId:null, eventId:'EV04', shipmentId:'SH012', recipientUserId:'U004', channel:'ALIMTALK', scope:'EXTERNAL',
      title:'[대외] MediaMarkt 파업 영향 안내',
      message:'안트베르펜 파업 예고로 SNR-2026-0012 양하 지연 가능성을 고객사에 사전 안내합니다.',
      status:'PENDING_APPROVAL', requestedBy:'U004', approvedBy:null, approvedAt:null, sentAt:null, readAt:null, failReason:null, createdAt:'2026-09-15T02:30:00Z' },
    { notificationId:'NT05', matchId:null, eventId:'EV01', shipmentId:'SH002', recipientUserId:'U002', channel:'ALIMTALK', scope:'INTERNAL',
      title:'[CRITICAL] SNR-2026-0002 호르무즈 통과 D-4',
      message:'MAERSK SENTOSA가 09/19 호르무즈 해협 통과 예정입니다. 납기 여유 1일로 즉시 대응이 필요합니다.',
      status:'SENT', requestedBy:'SYSTEM', approvedBy:null, approvedAt:null, sentAt:'2026-09-15T01:00:00Z', readAt:null, failReason:null, createdAt:'2026-09-15T01:00:00Z' },
    { notificationId:'NT06', matchId:null, eventId:'EV07', shipmentId:'SH004', recipientUserId:'U003', channel:'EMAIL', scope:'INTERNAL',
      title:'[MEDIUM] SNR-2026-0004 LA 통관 지연 예상',
      message:'미국 추가 관세 발효로 LA 통관 소요가 3~4일 증가하고 있습니다.',
      status:'FAILED', requestedBy:'SYSTEM', approvedBy:null, approvedAt:null, sentAt:null, readAt:null,
      failReason:'수신자 이메일 서버 응답 없음 (SMTP 550). 주소 확인 필요.', createdAt:'2026-09-14T23:10:00Z' }
  ],
  riskThresholds: DEFAULT_THRESHOLDS.map(t => ({ ...t, updatedBy:'U001', updatedAt:'2026-08-01T00:00:00Z' })),
  collectionJobs: [
    { jobId:'CJ01', sourceId:'SRC03', startedAt:'2026-09-15T04:05:00Z', finishedAt:'2026-09-15T04:05:12Z', status:'SUCCESS', fetchedCount:4,  processedCount:4,  errorMessage:null },
    { jobId:'CJ02', sourceId:'SRC02', startedAt:'2026-09-15T04:00:00Z', finishedAt:'2026-09-15T04:00:31Z', status:'SUCCESS', fetchedCount:21, processedCount:19, errorMessage:null },
    { jobId:'CJ03', sourceId:'SRC06', startedAt:'2026-09-15T03:45:00Z', finishedAt:'2026-09-15T03:45:08Z', status:'SUCCESS', fetchedCount:7,  processedCount:7,  errorMessage:null },
    { jobId:'CJ04', sourceId:'SRC01', startedAt:'2026-09-15T03:30:00Z', finishedAt:'2026-09-15T03:30:44Z', status:'SUCCESS', fetchedCount:12, processedCount:11, errorMessage:null },
    { jobId:'CJ05', sourceId:'SRC05', startedAt:'2026-09-15T03:00:00Z', finishedAt:'2026-09-15T03:00:19Z', status:'SUCCESS', fetchedCount:3,  processedCount:3,  errorMessage:null },
    { jobId:'CJ06', sourceId:'SRC04', startedAt:'2026-09-15T02:00:00Z', finishedAt:'2026-09-15T02:01:02Z', status:'PARTIAL', fetchedCount:5,  processedCount:3,  errorMessage:'2건 LLM 정형화 실패 (본문 길이 초과).' },
    { jobId:'CJ07', sourceId:'SRC08', startedAt:'2026-09-12T10:00:00Z', finishedAt:'2026-09-12T10:00:05Z', status:'FAILED',  fetchedCount:0,  processedCount:0,  errorMessage:'소스 비활성화됨 (관리자 조치).' }
  ],
  auditLogs: [
    { auditId:'AL01', actorUserId:'U001', action:'EVENT_PUBLISH',   targetType:'RISK_EVENT', targetId:'EV03', detail:"태풍 '너구리' 이벤트 발행", ip:'10.20.3.41', createdAt:'2026-09-14T22:00:00Z' },
    { auditId:'AL02', actorUserId:'U001', action:'EVENT_DISMISS',   targetType:'RISK_EVENT', targetId:'EV10', detail:'미확인 소셜 출처 기각',   ip:'10.20.3.41', createdAt:'2026-09-13T16:40:00Z' },
    { auditId:'AL03', actorUserId:'U001', action:'SOURCE_DISABLE',  targetType:'RISK_SOURCE',targetId:'SRC08', detail:'소셜 채널 수집 중단',    ip:'10.20.3.41', createdAt:'2026-09-13T16:42:00Z' },
    { auditId:'AL04', actorUserId:'U001', action:'USER_REJECT',     targetType:'USER',       targetId:'U007', detail:'가입 반려 (부서 불일치)',  ip:'10.20.3.41', createdAt:'2026-09-09T05:10:00Z' },
    { auditId:'AL05', actorUserId:'U001', action:'SHIPMENT_REJECT', targetType:'SHIPMENT',   targetId:'SH017', detail:'서류 불일치로 반려',      ip:'10.20.3.41', createdAt:'2026-09-10T06:20:00Z' },
    { auditId:'AL06', actorUserId:'U002', action:'ACTION_CREATE',   targetType:'SHIPMENT',   targetId:'SH001', detail:'War Risk 부보 확대 조치 등록', ip:'10.30.8.12', createdAt:'2026-09-13T02:30:00Z' }
  ],
  sessions: new Map(),

  now: () => new Date().toISOString(),
  nextId(prefix) {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return prefix + String(counters[prefix]).padStart(4, '0');
  }
};

// 기존 시드 ID 가 신규 발급 ID 와 충돌하지 않도록 카운터를 앞당긴다.
counters.MT = 0; counters.AC = 100; counters.FB = 100; counters.NT = 100;
counters.SH = 100; counters.EV = 100; counters.RF = 100; counters.AL = 100;
counters.SRC = 100; counters.EA = 100; counters.U = 100; counters.C = 100; counters.CJ = 100;

export function initDb() {
  linkRoutePoints(db.shipments, db.voyages);
  recomputeMatches(db);
  // 시드 조치/피드백/알림을 실제 매칭 건에 연결
  const link = (shipmentId, eventId) => {
    const m = db.impactMatches.find(x => x.shipmentId === shipmentId && (!eventId || x.eventId === eventId));
    return m ? m.matchId : null;
  };
  db.actionLogs.forEach(a => { a.matchId = a.matchId || link(a.shipmentId, null); });
  db.matchFeedbacks.forEach(f => { f.matchId = f.matchId || link(f.shipmentId, null); });
  db.notifications.forEach(n => { n.matchId = n.matchId || link(n.shipmentId, n.eventId); });
  // 피드백이 달린 건은 오탐으로 표시
  db.matchFeedbacks.filter(f => f.isRelevant === false).forEach(f => {
    const m = db.impactMatches.find(x => x.matchId === f.matchId);
    if (m) m.status = 'FALSE_POSITIVE';
  });
  // 조치가 등록된 건은 조치완료로 표시
  db.actionLogs.forEach(a => {
    const m = db.impactMatches.find(x => x.matchId === a.matchId);
    if (m && m.status === 'OPEN') m.status = 'ACTION_TAKEN';
  });
  return db;
}

export default db;
