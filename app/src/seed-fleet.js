// SONAR - 선박 / 항차 / 화물 시드 데이터 (기준일 2026-09-15)

export const vessels = [
  { vesselId: 'VS01', imoNo: '9863297', name: 'HMM ALGECIRAS',           carrierId: 'CR01', vesselType: 'CONTAINER', capacityTeu: 23964 },
  { vesselId: 'VS02', imoNo: '9839430', name: 'MSC GULSUN',              carrierId: 'CR03', vesselType: 'CONTAINER', capacityTeu: 23756 },
  { vesselId: 'VS03', imoNo: '9811000', name: 'EVER GIVEN',              carrierId: 'CR06', vesselType: 'CONTAINER', capacityTeu: 20124 },
  { vesselId: 'VS04', imoNo: '9806079', name: 'ONE APUS',                carrierId: 'CR04', vesselType: 'CONTAINER', capacityTeu: 14052 },
  { vesselId: 'VS05', imoNo: '9454436', name: 'CMA CGM MARCO POLO',      carrierId: 'CR05', vesselType: 'CONTAINER', capacityTeu: 16020 },
  { vesselId: 'VS06', imoNo: '9784283', name: 'MAERSK SENTOSA',          carrierId: 'CR02', vesselType: 'CONTAINER', capacityTeu: 15226 },
  { vesselId: 'VS07', imoNo: '9868091', name: 'HMM GARAM',               carrierId: 'CR01', vesselType: 'CONTAINER', capacityTeu: 4600  },
  { vesselId: 'VS08', imoNo: '9741345', name: 'ONE HARBOUR',             carrierId: 'CR04', vesselType: 'CONTAINER', capacityTeu: 8560  },
  { vesselId: 'VS09', imoNo: '9839404', name: 'MSC ISABELLA',            carrierId: 'CR03', vesselType: 'CONTAINER', capacityTeu: 23656 },
  { vesselId: 'VS10', imoNo: '9893881', name: 'EVER LOADING',            carrierId: 'CR06', vesselType: 'CONTAINER', capacityTeu: 12118 },
  { vesselId: 'VS11', imoNo: '9784269', name: 'MAERSK HANGZHOU',         carrierId: 'CR02', vesselType: 'CONTAINER', capacityTeu: 15226 },
  { vesselId: 'VS12', imoNo: '9702132', name: 'CMA CGM B. FRANKLIN',     carrierId: 'CR05', vesselType: 'CONTAINER', capacityTeu: 18000 },
  { vesselId: 'VS13', imoNo: '9868106', name: 'HMM PROMISE',             carrierId: 'CR01', vesselType: 'CONTAINER', capacityTeu: 16000 },
  { vesselId: 'VS14', imoNo: '9893890', name: 'EVER ACE',                carrierId: 'CR06', vesselType: 'CONTAINER', capacityTeu: 23992 }
];

// legs : 기항 스케줄, transits : 통과 예정 해상 요충지
export const voyages = [
  { voyageId: 'VY01', vesselId: 'VS01', voyageNo: '0128E', serviceRouteName: 'FE-EUR / FE4', status: 'IN_TRANSIT',
    currentLat: 13.52, currentLon: 42.81, currentSpeedKn: 18.2, currentHeading: 338, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P001', etd:'2026-08-26' }, { seq:2, portId:'P005', eta:'2026-08-31', etd:'2026-09-01' },
            { seq:3, portId:'P010', eta:'2026-09-05', etd:'2026-09-06' }, { seq:4, portId:'P017', eta:'2026-09-30' } ],
    transits: [ { chokePointId:'CP05', expectedPassageDate:'2026-09-04' }, { chokePointId:'CP02', expectedPassageDate:'2026-09-16' },
                { chokePointId:'CP03', expectedPassageDate:'2026-09-18' }, { chokePointId:'CP04', expectedPassageDate:'2026-09-21' } ] },

  { voyageId: 'VY02', vesselId: 'VS02', voyageNo: '0412W', serviceRouteName: 'AE7 / Asia-N.Europe', status: 'IN_TRANSIT',
    currentLat: 3.12, currentLon: 100.42, currentSpeedKn: 16.8, currentHeading: 302, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P003', etd:'2026-09-02' }, { seq:2, portId:'P010', eta:'2026-09-12', etd:'2026-09-13' },
            { seq:3, portId:'P018', eta:'2026-10-10' } ],
    transits: [ { chokePointId:'CP05', expectedPassageDate:'2026-09-15' }, { chokePointId:'CP02', expectedPassageDate:'2026-09-26' },
                { chokePointId:'CP03', expectedPassageDate:'2026-09-28' }, { chokePointId:'CP04', expectedPassageDate:'2026-10-01' } ] },

  { voyageId: 'VY03', vesselId: 'VS03', voyageNo: '1104W', serviceRouteName: 'CEM / Asia-Med', status: 'IN_TRANSIT',
    currentLat: 15.24, currentLon: 62.05, currentSpeedKn: 19.1, currentHeading: 288, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P010', etd:'2026-09-03' }, { seq:2, portId:'P012', eta:'2026-09-12', etd:'2026-09-13' },
            { seq:3, portId:'P017', eta:'2026-10-06' } ],
    transits: [ { chokePointId:'CP02', expectedPassageDate:'2026-09-22' }, { chokePointId:'CP03', expectedPassageDate:'2026-09-24' },
                { chokePointId:'CP04', expectedPassageDate:'2026-09-27' } ] },

  { voyageId: 'VY04', vesselId: 'VS04', voyageNo: '0077E', serviceRouteName: 'PS3 / Transpacific', status: 'IN_TRANSIT',
    currentLat: 38.51, currentLon: -160.02, currentSpeedKn: 21.4, currentHeading: 92, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P001', etd:'2026-09-06' }, { seq:2, portId:'P008', eta:'2026-09-08', etd:'2026-09-08' },
            { seq:3, portId:'P021', eta:'2026-09-20' } ],
    transits: [] },

  { voyageId: 'VY05', vesselId: 'VS05', voyageNo: '0233E', serviceRouteName: 'PEX3 / Asia-USEC', status: 'IN_TRANSIT',
    currentLat: 12.03, currentLon: -120.11, currentSpeedKn: 17.6, currentHeading: 96, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P005', etd:'2026-08-28' }, { seq:2, portId:'P024', eta:'2026-09-22', etd:'2026-09-23' },
            { seq:3, portId:'P023', eta:'2026-09-30' } ],
    transits: [ { chokePointId:'CP06', expectedPassageDate:'2026-09-23' } ] },

  { voyageId: 'VY06', vesselId: 'VS06', voyageNo: '0519W', serviceRouteName: 'ME2 / India-Gulf', status: 'IN_TRANSIT',
    currentLat: 23.04, currentLon: 60.52, currentSpeedKn: 15.9, currentHeading: 318, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P012', etd:'2026-09-11' }, { seq:2, portId:'P013', eta:'2026-09-17', etd:'2026-09-18' },
            { seq:3, portId:'P014', eta:'2026-09-20' } ],
    transits: [ { chokePointId:'CP01', expectedPassageDate:'2026-09-19' } ] },

  { voyageId: 'VY07', vesselId: 'VS07', voyageNo: '0901S', serviceRouteName: 'IAS / Intra-Asia', status: 'IN_TRANSIT',
    currentLat: 18.02, currentLon: 113.04, currentSpeedKn: 14.2, currentHeading: 210, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P002', etd:'2026-09-11' }, { seq:2, portId:'P006', eta:'2026-09-16', etd:'2026-09-16' },
            { seq:3, portId:'P009', eta:'2026-09-19' } ],
    transits: [] },

  { voyageId: 'VY08', vesselId: 'VS08', voyageNo: '0310S', serviceRouteName: 'A3N / Asia-Oceania', status: 'IN_TRANSIT',
    currentLat: 5.01, currentLon: 140.06, currentSpeedKn: 18.0, currentHeading: 152, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P001', etd:'2026-09-05' }, { seq:2, portId:'P026', eta:'2026-09-22' } ],
    transits: [] },

  { voyageId: 'VY09', vesselId: 'VS09', voyageNo: '0448W', serviceRouteName: 'AE5 / Asia-N.Europe', status: 'DELAYED',
    currentLat: 31.21, currentLon: 121.63, currentSpeedKn: 0.0, currentHeading: 0, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P003', etd:'2026-09-17' }, { seq:2, portId:'P004', eta:'2026-09-19', etd:'2026-09-20' },
            { seq:3, portId:'P010', eta:'2026-09-26', etd:'2026-09-27' }, { seq:4, portId:'P017', eta:'2026-10-21' } ],
    transits: [ { chokePointId:'CP05', expectedPassageDate:'2026-09-28' }, { chokePointId:'CP02', expectedPassageDate:'2026-10-06' },
                { chokePointId:'CP03', expectedPassageDate:'2026-10-08' }, { chokePointId:'CP04', expectedPassageDate:'2026-10-11' } ] },

  { voyageId: 'VY10', vesselId: 'VS10', voyageNo: '0166W', serviceRouteName: 'MED2 / Asia-Med', status: 'IN_TRANSIT',
    currentLat: 8.04, currentLon: 75.02, currentSpeedKn: 18.9, currentHeading: 296, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P007', etd:'2026-09-01' }, { seq:2, portId:'P010', eta:'2026-09-06', etd:'2026-09-07' },
            { seq:3, portId:'P020', eta:'2026-09-28' } ],
    transits: [ { chokePointId:'CP02', expectedPassageDate:'2026-09-18' }, { chokePointId:'CP03', expectedPassageDate:'2026-09-20' },
                { chokePointId:'CP04', expectedPassageDate:'2026-09-23' } ] },

  { voyageId: 'VY11', vesselId: 'VS11', voyageNo: '0620W', serviceRouteName: 'AE11 / Asia-N.Europe', status: 'IN_TRANSIT',
    currentLat: 25.02, currentLon: 122.03, currentSpeedKn: 16.1, currentHeading: 198, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P004', etd:'2026-09-13' }, { seq:2, portId:'P010', eta:'2026-09-21', etd:'2026-09-22' },
            { seq:3, portId:'P019', eta:'2026-10-17' } ],
    transits: [ { chokePointId:'CP08', expectedPassageDate:'2026-09-15' }, { chokePointId:'CP05', expectedPassageDate:'2026-09-23' },
                { chokePointId:'CP02', expectedPassageDate:'2026-10-02' }, { chokePointId:'CP03', expectedPassageDate:'2026-10-04' },
                { chokePointId:'CP04', expectedPassageDate:'2026-10-07' } ] },

  { voyageId: 'VY12', vesselId: 'VS12', voyageNo: '0801E', serviceRouteName: 'PRX / Transpacific', status: 'IN_TRANSIT',
    currentLat: 45.03, currentLon: -175.04, currentSpeedKn: 20.7, currentHeading: 84, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P001', etd:'2026-09-04' }, { seq:2, portId:'P022', eta:'2026-09-18' } ],
    transits: [] },

  { voyageId: 'VY13', vesselId: 'VS13', voyageNo: '0055W', serviceRouteName: 'FE-EUR / Cape Route', status: 'IN_TRANSIT',
    currentLat: -20.02, currentLon: 55.04, currentSpeedKn: 17.2, currentHeading: 232, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P010', etd:'2026-09-01' }, { seq:2, portId:'P017', eta:'2026-10-12' } ],
    transits: [ { chokePointId:'CP09', expectedPassageDate:'2026-09-21' }, { chokePointId:'CP07', expectedPassageDate:'2026-10-04' } ] },

  { voyageId: 'VY14', vesselId: 'VS14', voyageNo: '0199E', serviceRouteName: 'PS5 / Transpacific', status: 'IN_TRANSIT',
    currentLat: 35.04, currentLon: 165.02, currentSpeedKn: 19.8, currentHeading: 88, positionUpdatedAt: '2026-09-15T04:10:00Z',
    legs: [ { seq:1, portId:'P003', etd:'2026-09-08' }, { seq:2, portId:'P021', eta:'2026-09-23' } ],
    transits: [] }
];

const S = (shipmentId, shipmentNo, companyId, ownerUserId, voyageId, originPortId, destinationPortId,
           commodity, cargoValueUsd, etd, eta, customerDueDate, alt, status, extra = {}) => ({
  shipmentId, shipmentNo, companyId, ownerUserId, voyageId, originPortId, destinationPortId,
  commodity, cargoValueUsd, currency: 'USD', etd, eta, customerDueDate,
  alternativeRouteAvailable: alt, status,
  incoterms: extra.incoterms || 'FOB',
  containerNo: extra.containerNo || null,
  containerType: extra.containerType || '40HC',
  containerCount: extra.containerCount || 1,
  weightKg: extra.weightKg || 18000,
  customerName: extra.customerName || null,
  memo: extra.memo || null,
  rejectReason: extra.rejectReason || null,
  createdAt: extra.createdAt || '2026-08-20T09:00:00Z',
  approvedAt: extra.approvedAt || null,
  approvedBy: extra.approvedBy || null,
  routePoints: []
});

export const shipments = [
  S('SH001','SNR-2026-0001','C001','U002','VY01','P001','P017','반도체 포토레지스트',1450000,'2026-08-26','2026-09-30','2026-10-05',false,'IN_TRANSIT',
    { incoterms:'CIF', containerNo:'HDMU4182736', containerType:'20RF', containerCount:4, weightKg:42000, customerName:'ASML Netherlands B.V.', approvedAt:'2026-08-21T02:10:00Z', approvedBy:'U001' }),
  S('SH002','SNR-2026-0002','C001','U002','VY06','P012','P014','정밀 가공 부품',880000,'2026-09-11','2026-09-20','2026-09-21',false,'IN_TRANSIT',
    { incoterms:'CIF', containerNo:'MAEU7723910', containerCount:3, weightKg:51000, customerName:'Pars Industrial Co.', approvedAt:'2026-09-01T01:00:00Z', approvedBy:'U001' }),
  S('SH003','SNR-2026-0003','C001','U002','VY09','P003','P017','배터리 전해액',620000,'2026-09-17','2026-10-21','2026-11-10',true,'ACTIVE',
    { incoterms:'FOB', containerType:'20TK', containerCount:6, weightKg:96000, customerName:'Northvolt AB', approvedAt:'2026-09-05T06:30:00Z', approvedBy:'U001' }),
  S('SH004','SNR-2026-0004','C001','U003','VY04','P001','P021','디스플레이 패널',2100000,'2026-09-06','2026-09-20','2026-09-25',false,'IN_TRANSIT',
    { incoterms:'DAP', containerNo:'ONEY6621045', containerCount:8, weightKg:64000, customerName:'Vizio Inc.', approvedAt:'2026-08-30T03:20:00Z', approvedBy:'U001' }),
  S('SH005','SNR-2026-0005','C001','U003','VY02','P003','P018','산업용 로봇',1780000,'2026-09-02','2026-10-10','2026-10-15',false,'IN_TRANSIT',
    { incoterms:'CIF', containerNo:'MSCU9910233', containerType:'40OT', containerCount:5, weightKg:88000, customerName:'KUKA Deutschland GmbH', approvedAt:'2026-08-27T08:00:00Z', approvedBy:'U001' }),
  S('SH006','SNR-2026-0006','C001','U002','VY12','P001','P022','이차전지 양극재',540000,'2026-09-04','2026-09-18','2026-10-02',true,'IN_TRANSIT',
    { containerCount:4, weightKg:72000, customerName:'Ultium Cells LLC', approvedAt:'2026-08-28T05:00:00Z', approvedBy:'U001' }),
  S('SH007','SNR-2026-0007','C001','U003','VY07','P002','P009','전자부품 (SMD)',310000,'2026-09-11','2026-09-19','2026-09-30',true,'IN_TRANSIT',
    { containerCount:2, weightKg:21000, customerName:'Samsung Electronics Vietnam', approvedAt:'2026-09-02T02:00:00Z', approvedBy:'U001' }),
  S('SH008','SNR-2026-0008','C001','U002','VY13','P010','P017','특수강 코일',960000,'2026-09-01','2026-10-12','2026-10-30',true,'IN_TRANSIT',
    { containerType:'40FR', containerCount:7, weightKg:154000, customerName:'ThyssenKrupp AG', memo:'희망봉 우회 항로 선제 적용 건', approvedAt:'2026-08-25T04:00:00Z', approvedBy:'U001' }),

  S('SH009','SNR-2026-0009','C002','U004','VY03','P010','P017','의류 혼재화물 (LCL)',420000,'2026-09-03','2026-10-06','2026-10-12',false,'IN_TRANSIT',
    { incoterms:'FCA', containerCount:3, weightKg:34000, customerName:'C&A Europe', approvedAt:'2026-08-26T07:00:00Z', approvedBy:'U001' }),
  S('SH010','SNR-2026-0010','C002','U004','VY10','P007','P020','자전거 부품',180000,'2026-09-01','2026-09-28','2026-10-20',true,'IN_TRANSIT',
    { containerCount:2, weightKg:19000, customerName:'Orbea S.Coop.', approvedAt:'2026-08-24T07:00:00Z', approvedBy:'U001' }),
  S('SH011','SNR-2026-0011','C002','U004','VY05','P005','P023','조립식 가구',260000,'2026-08-28','2026-09-30','2026-10-08',true,'IN_TRANSIT',
    { containerCount:6, weightKg:58000, customerName:'Wayfair LLC', approvedAt:'2026-08-22T07:00:00Z', approvedBy:'U001' }),
  S('SH012','SNR-2026-0012','C002','U004','VY11','P004','P019','생활가전 (냉장고)',730000,'2026-09-13','2026-10-17','2026-10-25',false,'IN_TRANSIT',
    { containerCount:9, weightKg:112000, customerName:'MediaMarkt Belgium', approvedAt:'2026-09-06T07:00:00Z', approvedBy:'U001' }),
  S('SH013','SNR-2026-0013','C002','U004','VY08','P001','P026','건설자재 (형강)',150000,'2026-09-05','2026-09-22','2026-10-10',true,'IN_TRANSIT',
    { containerType:'40FR', containerCount:5, weightKg:128000, customerName:'Boral Limited', approvedAt:'2026-08-29T07:00:00Z', approvedBy:'U001' }),
  S('SH014','SNR-2026-0014','C002','U004','VY14','P003','P021','완구 (플라스틱)',95000,'2026-09-08','2026-09-23','2026-10-15',true,'IN_TRANSIT',
    { containerCount:4, weightKg:26000, customerName:'Target Corporation', approvedAt:'2026-09-01T07:00:00Z', approvedBy:'U001' }),

  S('SH015','SNR-2026-0015','C003','U005','VY01','P001','P017','산업용 밸브 부품',340000,'2026-08-26','2026-09-30','2026-10-04',false,'PENDING_APPROVAL',
    { containerCount:2, weightKg:24000, customerName:'Emerson Europe', createdAt:'2026-09-14T11:20:00Z' }),
  S('SH016','SNR-2026-0016','C003','U005',null,'P001','P010','CNC 공작기계',410000,'2026-09-25','2026-10-08','2026-10-20',true,'PENDING_APPROVAL',
    { containerType:'40OT', containerCount:2, weightKg:36000, customerName:'Makino Asia Pte Ltd', createdAt:'2026-09-15T01:05:00Z' }),
  S('SH017','SNR-2026-0017','C001','U003',null,'P001','P008','반도체 시험장비',70000,'2026-09-20','2026-09-24','2026-10-05',true,'REJECTED',
    { containerCount:1, weightKg:8000, customerName:'Advantest Corp.', createdAt:'2026-09-10T03:00:00Z',
      rejectReason:'인보이스 가액(70,000 USD)과 첨부 P/L 금액이 불일치합니다. 서류 보완 후 재등록 바랍니다.' }),
  S('SH018','SNR-2026-0018','C001','U002',null,'P001','P003','알루미늄 잉곳',220000,'2026-08-10','2026-08-16','2026-08-25',true,'ARRIVED',
    { containerCount:5, weightKg:98000, customerName:'Shanghai Huayi Group', approvedAt:'2026-08-05T07:00:00Z', approvedBy:'U001' })
];

// 화물의 경유 요충지는 배정된 항차의 통과 예정 지점에서 파생된다.
export function linkRoutePoints(shipmentList, voyageList) {
  for (const s of shipmentList) {
    const v = voyageList.find(x => x.voyageId === s.voyageId);
    s.routePoints = v ? v.transits.map((t, i) => ({ seq: i + 1, ...t })) : [];
  }
}
