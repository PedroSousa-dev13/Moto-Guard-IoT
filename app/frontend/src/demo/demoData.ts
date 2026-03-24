import type {
  Motorcycle,
  MotorcycleSummary,
  Trip,
  TripFeedItem,
  TripTelemetryPoint,
  TripEvaluationResponse,
} from '../types/index';

// ---------------------------------------------------------------------------
// Local interface for demo alerts (Alert type not in types/index.ts)
// ---------------------------------------------------------------------------
export interface DemoAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  tripId?: string;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Helper: generate ≥50 telemetry points for a trip
// ---------------------------------------------------------------------------
function generateTelemetry(
  tripId: string,
  startIso: string,
  count = 55,
): TripTelemetryPoint[] {
  const points: TripTelemetryPoint[] = [];
  const startMs = new Date(startIso).getTime();

  // Base Lisbon coordinates
  const baseLat = 38.7169;
  const baseLon = -9.1399;

  for (let i = 0; i < count; i++) {
    const t = i / count; // 0..1 progress
    const timeMs = startMs + i * 5000; // 5s apart

    // Speed: ramp up, cruise, ramp down
    const speedCurve =
      t < 0.15
        ? t / 0.15
        : t > 0.85
        ? (1 - t) / 0.15
        : 1;
    const speed_kmh = Math.round(
      20 + 120 * speedCurve * (0.85 + 0.15 * Math.sin(i * 0.7)),
    );

    // RPM follows speed roughly
    const rpm = Math.round(1000 + 8000 * speedCurve * (0.8 + 0.2 * Math.cos(i * 0.5)));

    // Gear 1-6 based on speed
    const gear = Math.min(6, Math.max(1, Math.ceil(speed_kmh / 25)));

    // Roll oscillates like cornering
    const roll_deg = parseFloat((40 * Math.sin(i * 0.4) * speedCurve).toFixed(1));

    // G-force
    const g_force = parseFloat((0.8 + 1.7 * Math.abs(Math.sin(i * 0.3))).toFixed(2));

    // Throttle
    const throttle_pct = Math.round(
      Math.max(0, Math.min(100, 60 * speedCurve + 20 * Math.sin(i * 0.6))),
    );

    // Engine temp: warms up then stabilises
    const engine_temp_c = Math.round(60 + 40 * Math.min(1, t * 3) + 5 * Math.sin(i * 0.2));

    // Voltage: slight oscillation around 13.8V
    const voltage = parseFloat((13.8 + 0.4 * Math.sin(i * 0.15)).toFixed(2));

    // Braking: occasional front brake
    const brake_front_pct = speed_kmh > 80 && Math.sin(i * 1.1) < -0.7
      ? Math.round(30 + 40 * Math.abs(Math.sin(i * 1.1)))
      : 0;

    // GPS: small increments from Lisbon base
    const latitude = parseFloat((baseLat + i * 0.0002 * Math.cos(i * 0.1)).toFixed(6));
    const longitude = parseFloat((baseLon + i * 0.0002 * Math.sin(i * 0.1)).toFixed(6));

    points.push({
      time: new Date(timeMs).toISOString(),
      device_id: `DEMO-DEVICE-${tripId.slice(-3)}`,
      moto_model: 'Honda CB650R Demo',
      speed_kmh,
      rpm,
      gear,
      throttle_pct,
      engine_temp_c,
      voltage,
      brake_front_pct,
      brake_rear_pct: 0,
      roll_deg,
      pitch_deg: parseFloat((5 * Math.sin(i * 0.25)).toFixed(1)),
      yaw_deg: parseFloat((10 * Math.cos(i * 0.18)).toFixed(1)),
      g_force,
      latitude,
      longitude,
      oil_pressure_bar: parseFloat((3.5 + 0.5 * Math.sin(i * 0.1)).toFixed(2)),
      tire_pressure_front_bar: 2.5,
      tire_pressure_rear_bar: 2.8,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Task 2.1 — 2 motorcycles
// ---------------------------------------------------------------------------
export const demoMotorcycles: Motorcycle[] = [
  {
    id: 'demo-moto-001',
    userId: 'demo-user-001',
    name: 'Honda CB650R Demo',
    brand: 'Honda',
    model: 'CB650R',
    year: 2023,
    category: 'naked',
    plate: 'DEMO-01',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'demo-moto-002',
    userId: 'demo-user-001',
    name: 'Yamaha MT-07 Demo',
    brand: 'Yamaha',
    model: 'MT-07',
    year: 2022,
    category: 'naked',
    plate: 'DEMO-02',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
];

const motoSummary1: MotorcycleSummary = {
  id: 'demo-moto-001',
  name: 'Honda CB650R Demo',
  brand: 'Honda',
  category: 'naked',
};

const motoSummary2: MotorcycleSummary = {
  id: 'demo-moto-002',
  name: 'Yamaha MT-07 Demo',
  brand: 'Yamaha',
  category: 'naked',
};

// ---------------------------------------------------------------------------
// Task 2.2 — 5 trips (4 COMPLETED + 1 ACTIVE)
// Task 2.6 — all COMPLETED have startedAt < endedAt and distanceKm > 0
// ---------------------------------------------------------------------------
export const demoTrips: Trip[] = [
  {
    id: 'demo-trip-001',
    userId: 'demo-user-001',
    motorcycleId: 'demo-moto-001',
    source: 'DEVICE_REAL',
    startedAt: '2024-03-10T08:00:00Z',
    endedAt: '2024-03-10T09:15:00Z',   // > startedAt ✓
    distanceKm: 42.3,                   // > 0 ✓
    maxSpeedKmh: 138,
    avgSpeedKmh: 56,
    maxRollDeg: 38,
    maxGForce: 2.1,
    status: 'COMPLETED',
    category: 'COMMUTE',
    categoryConfidence: 0.88,
    createdAt: '2024-03-10T08:00:00Z',
    motorcycle: motoSummary1,
    events: [
      {
        id: 'demo-event-001-1',
        tripId: 'demo-trip-001',
        type: 'HARD_BRAKING',
        severity: 'WARNING',
        message: 'Travagem brusca detetada a 95 km/h',
        latitude: 38.7200,
        longitude: -9.1350,
        speedKmh: 95,
        gForce: 1.9,
        occurredAt: '2024-03-10T08:22:00Z',
        createdAt: '2024-03-10T08:22:00Z',
      },
      {
        id: 'demo-event-001-2',
        tripId: 'demo-trip-001',
        type: 'SPEEDING',
        severity: 'INFO',
        message: 'Velocidade acima do limite: 138 km/h',
        latitude: 38.7250,
        longitude: -9.1300,
        speedKmh: 138,
        occurredAt: '2024-03-10T08:45:00Z',
        createdAt: '2024-03-10T08:45:00Z',
      },
    ],
    _count: { events: 2 },
  },
  {
    id: 'demo-trip-002',
    userId: 'demo-user-001',
    motorcycleId: 'demo-moto-002',
    source: 'SIMULATOR',
    startedAt: '2024-03-12T14:00:00Z',
    endedAt: '2024-03-12T14:45:00Z',   // > startedAt ✓
    distanceKm: 18.7,                   // > 0 ✓
    maxSpeedKmh: 112,
    avgSpeedKmh: 42,
    maxRollDeg: 42,
    maxGForce: 2.3,
    status: 'COMPLETED',
    category: 'WEEKEND_RIDE',
    categoryConfidence: 0.72,
    createdAt: '2024-03-12T14:00:00Z',
    motorcycle: motoSummary2,
    events: [
      {
        id: 'demo-event-002-1',
        tripId: 'demo-trip-002',
        type: 'EXCESSIVE_LEAN',
        severity: 'WARNING',
        message: 'Inclinação excessiva: 42°',
        latitude: 38.7180,
        longitude: -9.1420,
        rollDeg: 42,
        speedKmh: 78,
        occurredAt: '2024-03-12T14:20:00Z',
        createdAt: '2024-03-12T14:20:00Z',
      },
      {
        id: 'demo-event-002-2',
        tripId: 'demo-trip-002',
        type: 'HARD_BRAKING',
        severity: 'CRITICAL',
        message: 'Travagem de emergência detetada',
        latitude: 38.7160,
        longitude: -9.1380,
        speedKmh: 112,
        gForce: 2.3,
        occurredAt: '2024-03-12T14:35:00Z',
        createdAt: '2024-03-12T14:35:00Z',
      },
    ],
    _count: { events: 2 },
  },
  {
    id: 'demo-trip-003',
    userId: 'demo-user-001',
    motorcycleId: 'demo-moto-001',
    source: 'GPX_IMPORTED',
    startedAt: '2024-03-15T07:30:00Z',
    endedAt: '2024-03-15T10:30:00Z',   // > startedAt ✓
    distanceKm: 95.1,                   // > 0 ✓
    maxSpeedKmh: 130,
    avgSpeedKmh: 63,
    maxRollDeg: 35,
    maxGForce: 1.8,
    status: 'COMPLETED',
    category: 'WEEKEND_RIDE',
    categoryConfidence: 0.91,
    createdAt: '2024-03-15T07:30:00Z',
    motorcycle: motoSummary1,
    events: [
      {
        id: 'demo-event-003-1',
        tripId: 'demo-trip-003',
        type: 'SPEEDING',
        severity: 'INFO',
        message: 'Velocidade elevada em estrada nacional: 130 km/h',
        latitude: 38.7300,
        longitude: -9.1200,
        speedKmh: 130,
        occurredAt: '2024-03-15T09:00:00Z',
        createdAt: '2024-03-15T09:00:00Z',
      },
    ],
    _count: { events: 1 },
  },
  {
    id: 'demo-trip-004',
    userId: 'demo-user-001',
    motorcycleId: 'demo-moto-002',
    source: 'SIMULATOR',
    startedAt: '2024-03-18T18:00:00Z',
    endedAt: '2024-03-18T18:20:00Z',   // > startedAt ✓
    distanceKm: 7.2,                    // > 0 ✓
    maxSpeedKmh: 85,
    avgSpeedKmh: 28,
    maxRollDeg: 44,
    maxGForce: 2.4,
    status: 'COMPLETED',
    category: 'COMMUTE',
    categoryConfidence: 0.65,
    createdAt: '2024-03-18T18:00:00Z',
    motorcycle: motoSummary2,
    events: [
      {
        id: 'demo-event-004-1',
        tripId: 'demo-trip-004',
        type: 'EXCESSIVE_LEAN',
        severity: 'CRITICAL',
        message: 'Inclinação crítica: 44° a baixa velocidade',
        latitude: 38.7140,
        longitude: -9.1450,
        rollDeg: 44,
        speedKmh: 35,
        gForce: 2.4,
        occurredAt: '2024-03-18T18:10:00Z',
        createdAt: '2024-03-18T18:10:00Z',
      },
      {
        id: 'demo-event-004-2',
        tripId: 'demo-trip-004',
        type: 'HARD_BRAKING',
        severity: 'WARNING',
        message: 'Múltiplas travagens bruscas detetadas',
        latitude: 38.7130,
        longitude: -9.1460,
        speedKmh: 85,
        gForce: 2.1,
        occurredAt: '2024-03-18T18:15:00Z',
        createdAt: '2024-03-18T18:15:00Z',
      },
    ],
    _count: { events: 2 },
  },
  {
    id: 'demo-trip-005',
    userId: 'demo-user-001',
    motorcycleId: 'demo-moto-001',
    source: 'DEVICE_REAL',
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
    // endedAt: undefined — ACTIVE trip
    distanceKm: 12.4,
    maxSpeedKmh: 95,
    avgSpeedKmh: 48,
    maxRollDeg: 28,
    maxGForce: 1.6,
    status: 'ACTIVE',
    category: null,
    categoryConfidence: null,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    motorcycle: motoSummary1,
    events: [
      {
        id: 'demo-event-005-1',
        tripId: 'demo-trip-005',
        type: 'SPEEDING',
        severity: 'INFO',
        message: 'Velocidade acima do limite: 95 km/h',
        latitude: 38.7190,
        longitude: -9.1360,
        speedKmh: 95,
        occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
    _count: { events: 1 },
  },
];

// ---------------------------------------------------------------------------
// Task 2.3 — 5 TripFeedItems (1:1 with trips)
// ---------------------------------------------------------------------------
export const demoFeedItems: TripFeedItem[] = [
  {
    id: 'demo-trip-001',
    startedAt: '2024-03-10T08:00:00Z',
    endedAt: '2024-03-10T09:15:00Z',
    status: 'COMPLETED',
    source: 'DEVICE_REAL',
    distanceKm: 42.3,
    avgSpeedKmh: 56,
    maxSpeedKmh: 138,
    motorcycle: motoSummary1,
    eventCounts: {
      total: 2,
      bySeverity: { INFO: 1, WARNING: 1, CRITICAL: 0 },
      byType: { HARD_BRAKING: 1, SPEEDING: 1 },
    },
    safetyScore: 87,
    performanceScore: 74,
    labels: ['Commute', 'Device Real'],
    buckets: { safety: 'good', performance: 'warn' },
    category: 'COMMUTE',
    categoryConfidence: 0.88,
  },
  {
    id: 'demo-trip-002',
    startedAt: '2024-03-12T14:00:00Z',
    endedAt: '2024-03-12T14:45:00Z',
    status: 'COMPLETED',
    source: 'SIMULATOR',
    distanceKm: 18.7,
    avgSpeedKmh: 42,
    maxSpeedKmh: 112,
    motorcycle: motoSummary2,
    eventCounts: {
      total: 2,
      bySeverity: { INFO: 0, WARNING: 1, CRITICAL: 1 },
      byType: { EXCESSIVE_LEAN: 1, HARD_BRAKING: 1 },
    },
    safetyScore: 62,
    performanceScore: 58,
    labels: ['Weekend Ride', 'Simulator'],
    buckets: { safety: 'warn', performance: 'warn' },
    category: 'WEEKEND_RIDE',
    categoryConfidence: 0.72,
  },
  {
    id: 'demo-trip-003',
    startedAt: '2024-03-15T07:30:00Z',
    endedAt: '2024-03-15T10:30:00Z',
    status: 'COMPLETED',
    source: 'GPX_IMPORTED',
    distanceKm: 95.1,
    avgSpeedKmh: 63,
    maxSpeedKmh: 130,
    motorcycle: motoSummary1,
    eventCounts: {
      total: 1,
      bySeverity: { INFO: 1, WARNING: 0, CRITICAL: 0 },
      byType: { SPEEDING: 1 },
    },
    safetyScore: 91,
    performanceScore: 88,
    labels: ['Weekend Ride', 'GPX Import'],
    buckets: { safety: 'good', performance: 'good' },
    category: 'WEEKEND_RIDE',
    categoryConfidence: 0.91,
  },
  {
    id: 'demo-trip-004',
    startedAt: '2024-03-18T18:00:00Z',
    endedAt: '2024-03-18T18:20:00Z',
    status: 'COMPLETED',
    source: 'SIMULATOR',
    distanceKm: 7.2,
    avgSpeedKmh: 28,
    maxSpeedKmh: 85,
    motorcycle: motoSummary2,
    eventCounts: {
      total: 2,
      bySeverity: { INFO: 0, WARNING: 1, CRITICAL: 1 },
      byType: { EXCESSIVE_LEAN: 1, HARD_BRAKING: 1 },
    },
    safetyScore: 45,
    performanceScore: 40,
    labels: ['Commute', 'Simulator'],
    buckets: { safety: 'bad', performance: 'bad' },
    category: 'COMMUTE',
    categoryConfidence: 0.65,
  },
  {
    id: 'demo-trip-005',
    startedAt: demoTrips[4].startedAt,
    endedAt: null,
    status: 'ACTIVE',
    source: 'DEVICE_REAL',
    distanceKm: 12.4,
    avgSpeedKmh: 48,
    maxSpeedKmh: 95,
    motorcycle: motoSummary1,
    eventCounts: {
      total: 1,
      bySeverity: { INFO: 1, WARNING: 0, CRITICAL: 0 },
      byType: { SPEEDING: 1 },
    },
    safetyScore: 78,
    performanceScore: 70,
    labels: ['Em curso', 'Device Real'],
    buckets: { safety: 'good', performance: 'warn' },
    category: null,
    categoryConfidence: null,
  },
];

// ---------------------------------------------------------------------------
// Task 2.4 — ≥50 telemetry points per trip
// ---------------------------------------------------------------------------
export const demoTelemetry: Record<string, TripTelemetryPoint[]> = {
  'demo-trip-001': generateTelemetry('demo-trip-001', '2024-03-10T08:00:00Z'),
  'demo-trip-002': generateTelemetry('demo-trip-002', '2024-03-12T14:00:00Z'),
  'demo-trip-003': generateTelemetry('demo-trip-003', '2024-03-15T07:30:00Z'),
  'demo-trip-004': generateTelemetry('demo-trip-004', '2024-03-18T18:00:00Z'),
  'demo-trip-005': generateTelemetry('demo-trip-005', demoTrips[4].startedAt),
};

// ---------------------------------------------------------------------------
// Task 2.5 — 3 alerts: INFO, WARNING, CRITICAL
// ---------------------------------------------------------------------------
export const demoAlerts: DemoAlert[] = [
  {
    id: 'demo-alert-001',
    severity: 'CRITICAL',
    title: 'Queda detetada',
    message: 'Possível queda detetada com base nos dados do IMU. Verifique o estado do piloto.',
    tripId: 'demo-trip-004',
    occurredAt: '2024-03-18T18:10:00Z',
  },
  {
    id: 'demo-alert-002',
    severity: 'WARNING',
    title: 'Travagem brusca',
    message: 'Travagem brusca registada a 95 km/h. Considere ajustar o estilo de condução.',
    tripId: 'demo-trip-001',
    occurredAt: '2024-03-10T08:22:00Z',
  },
  {
    id: 'demo-alert-003',
    severity: 'INFO',
    title: 'Velocidade elevada',
    message: 'Velocidade máxima de 138 km/h registada durante a viagem.',
    tripId: 'demo-trip-001',
    occurredAt: '2024-03-10T08:45:00Z',
  },
];

// ---------------------------------------------------------------------------
// Task 2.7 — demoEvaluation for /trips/:id/evaluation
// ---------------------------------------------------------------------------
export const demoEvaluation: TripEvaluationResponse = {
  score: 87,
  model: 'heuristic-v2',
  mlScore: 84,
  mlFeedback:
    'Condução geral segura. Foram detetados 2 eventos de risco menores. Recomenda-se reduzir a velocidade em zonas urbanas.',
  comparisonReport: {
    heuristicScore: 87,
    mlScore: 84,
    scoreDelta: 3,
    agreement: true,
    agreementLevel: 'HIGH',
    dominantFactors: ['speed_compliance', 'braking_smoothness', 'lean_angle'],
    note: 'Modelo heurístico e ML concordam na avaliação geral da viagem.',
  },
  severityCounts: { INFO: 1, WARNING: 1, CRITICAL: 0 },
  typeCounts: {
    HARD_BRAKING: 1,
    SPEEDING: 1,
  },
  penalties: [
    { reason: 'Travagem brusca detetada', points: -8 },
    { reason: 'Velocidade acima do limite', points: -5 },
  ],
};
