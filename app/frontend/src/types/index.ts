export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Motorcycle {
  id: string;
  userId: string;
  profileId?: string | null;
  name: string;
  brand?: string;
  year?: number;
  deviceId?: string;
  createdAt: string;
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

export interface Trip {
  id: string;
  userId: string;
  motorcycleId: string;
  source: 'SIMULATOR' | 'GPX_IMPORTED' | 'DEVICE_REAL';
  startedAt: string;
  endedAt?: string;
  distanceKm?: number;
  maxSpeedKmh?: number;
  avgSpeedKmh?: number;
  maxRollDeg?: number;
  maxGForce?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  motorcycle: Motorcycle;
  gpxData?: GpxData | null;
  events: TripEvent[];
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
