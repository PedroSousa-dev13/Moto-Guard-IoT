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
  name: string;
  brand?: string;
  year?: number;
  deviceId?: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  userId: string;
  motorcycleId: string;
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
