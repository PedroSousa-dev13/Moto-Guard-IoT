export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  emergencyContact?: string | null;
}

export interface Motorcycle {
  id: string;
  userId: string;
  profileId?: string | null;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  deviceId?: string;
  category?: string;
  odometer?: number;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt?: string;
  profile?: { id: string; name: string } | null;
}

export interface MotorcycleProfile {
  id: string;
  name: string;
  maxSpeedKmh: number;
  typicalMaxRollDeg: number;
  crashRollThreshold: number;
  crashGForce: number;
  criticalTemp: number;
  criticalVoltage: number;
  criticalRpm: number;
  createdAt: string;
}

export interface MotorcycleSummary {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  profile?: { id: string; name: string } | null;
}

export interface GpxData {
  id: string;
  tripId: string;
  filename: string;
  fileSize: number;
  waypoints: Array<{ lat: number; lon: number; ele?: number; time?: string }>;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  totalTime?: number;
  importDate: string;
  createdAt: string;
}

export type TripSource = "SIMULATOR" | "GPX_IMPORTED" | "DEVICE_REAL";
export type TripStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type TripCategory = "COMMUTE" | "WEEKEND_RIDE" | "TRACK_DAY" | "OFF_ROAD";
export type DrivingStyle = "AGGRESSIVE" | "DEFENSIVE" | "ECONOMY";

export interface Trip {
  id: string;
  userId: string;
  motorcycleId: string;
  source: TripSource;
  startedAt: string;
  endedAt?: string;
  distanceKm?: number;
  maxSpeedKmh?: number;
  avgSpeedKmh?: number;
  maxRollDeg?: number;
  maxGForce?: number;
  status: TripStatus;
  category?: TripCategory | null;
  categoryConfidence?: number | null;
  drivingStyle?: DrivingStyle | null;
  createdAt: string;
  motorcycle: MotorcycleSummary;
  gpxData?: GpxData | null;
  events?: TripEvent[];
  safetyScore?: number;
  performanceScore?: number;
  _count?: { events: number };
}

export interface TripEvent {
  id: string;
  tripId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  latitude?: number;
  longitude?: number;
  speedKmh?: number;
  rollDeg?: number;
  gForce?: number;
  engineTempC?: number;
  voltage?: number;
  occurredAt: string;
  createdAt: string;
}

export interface TripTelemetryPoint {
  time: string;
  device_id?: string;
  moto_model?: string;
  speed_kmh?: number;
  rpm?: number;
  gear?: number;
  throttle_pct?: number;
  engine_temp_c?: number;
  voltage?: number;
  brake_front_pct?: number;
  brake_rear_pct?: number;
  roll_deg?: number;
  pitch_deg?: number;
  yaw_deg?: number;
  g_force?: number;
  latitude?: number;
  longitude?: number;
  oil_pressure_bar?: number;
  tire_pressure_front_bar?: number;
  tire_pressure_rear_bar?: number;
}

export interface TripTelemetryResponse {
  trip: { id: string; startedAt: string; endedAt: string | null; status: TripStatus };
  total_points: number;
  data: TripTelemetryPoint[];
}

export interface GpxImportResponse {
  tripId: string;
  gpxDataId: string;
  stats: {
    points: number;
    distanceKm: number;
    totalTimeSec: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
  };
}

export type TripScoreBucket = "good" | "warn" | "bad";

export interface TripFeedItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: TripStatus;
  source: TripSource;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  motorcycle: MotorcycleSummary | null;
  eventCounts: {
    total: number;
    bySeverity: { INFO: number; WARNING: number; CRITICAL: number };
    byType?: Record<string, number>;
  };
  safetyScore: number;
  performanceScore: number;
  labels: string[];
  buckets: { safety: TripScoreBucket; performance: TripScoreBucket };
  category?: TripCategory | null;
  categoryConfidence?: number | null;
  drivingStyle?: DrivingStyle | null;
}

export interface ComparisonReport {
  heuristicScore: number;
  mlScore: number;
  scoreDelta: number;
  agreement: boolean;
  agreementLevel: "HIGH" | "MEDIUM" | "LOW";
  dominantFactors: string[];
  note: string | null;
}

export interface TripEvaluationResponse {
  score: number;
  model: string;
  mlScore: number | null;
  mlFeedback: string;
  comparisonReport: ComparisonReport | null;
  severityCounts: { INFO: number; WARNING: number; CRITICAL: number };
  typeCounts: Partial<Record<string, number>>;
  penalties: Array<{ reason: string; points: number }>;
}
