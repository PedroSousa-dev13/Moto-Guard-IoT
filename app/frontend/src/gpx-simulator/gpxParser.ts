// =============================================================================
// MotoGuard IoT — GPX Parser
// =============================================================================
// Client-side GPX file parser that produces ParsedRow[] compatible with the
// existing useSyncEngine and telemetry emission pipeline.
//
// Derives speed via haversine, acceleration from Δspeed, pitch from slope,
// and enriches with motorcycle physics (RPM, gear, throttle, temp, voltage).
//
// Data coherence:
//  - Speed is smoothed (EMA) to eliminate GPS jitter
//  - Gear transitions are gradual (max ±1 per step)
//  - Engine temp ramps naturally from cold start
//  - Throttle includes cruise component for constant-speed riding
//  - Voltage uses smooth deterministic variation
//  - Data is capped at MAX_DURATION_SEC (10 min) for performance
// =============================================================================

import type { ParsedRow, ParseResult, ParseError } from "../real-simulator/csvParser";

// Re-export types for consumers
export type { ParsedRow, ParseResult, ParseError };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum duration in seconds — GPX data is trimmed beyond this */
const MAX_DURATION_SEC = 600; // 10 minutes

/** Exponential moving average alpha for speed smoothing (0 = no smoothing, 1 = raw) */
const SPEED_SMOOTH_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// Motorcycle Profiles (same as csvParser.ts / enhanced_simulator.py)
// ---------------------------------------------------------------------------

interface MotorcycleProfile {
  rpm_max: number;
  rpm_idle: number;
  temp_motor_min: number;
  temp_motor_max: number;
  voltagem_nominal: number;
  voltagem_min: number;
  voltagem_max: number;
  transmissao: 'manual' | 'CVT';
  gear_ratios: Record<string, number> | { type: 'CVT'; min_ratio: number; max_ratio: number };
  wheel_diameter_m: number;
  final_drive_ratio: number;
}

const MOTORCYCLE_PROFILES: Record<string, MotorcycleProfile> = {
  "Scooter": {
    rpm_max: 9000, rpm_idle: 1500,
    temp_motor_min: 60, temp_motor_max: 90,
    voltagem_nominal: 14.2, voltagem_min: 11.5, voltagem_max: 14.5,
    transmissao: "CVT",
    gear_ratios: { type: "CVT", min_ratio: 2.0, max_ratio: 0.5 },
    wheel_diameter_m: 0.4, final_drive_ratio: 1.0,
  },
  "Naked": {
    rpm_max: 12000, rpm_idle: 1200,
    temp_motor_min: 70, temp_motor_max: 105,
    voltagem_nominal: 14.2, voltagem_min: 11.5, voltagem_max: 14.5,
    transmissao: "manual",
    gear_ratios: { "1": 15.0, "2": 12.0, "3": 9.5, "4": 7.5, "5": 6.0, "6": 5.0 },
    wheel_diameter_m: 0.6, final_drive_ratio: 2.8,
  },
  "Desportiva": {
    rpm_max: 15000, rpm_idle: 1000,
    temp_motor_min: 80, temp_motor_max: 110,
    voltagem_nominal: 14.2, voltagem_min: 11.5, voltagem_max: 14.5,
    transmissao: "manual",
    gear_ratios: { "1": 16.0, "2": 13.0, "3": 10.0, "4": 8.0, "5": 6.5, "6": 5.5 },
    wheel_diameter_m: 0.6, final_drive_ratio: 2.5,
  },
};

// ---------------------------------------------------------------------------
// Haversine distance (meters) between two GPS coordinates
// ---------------------------------------------------------------------------

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlam = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Bearing (degrees) between two GPS coordinates
// ---------------------------------------------------------------------------

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dlam = ((lon2 - lon1) * Math.PI) / 180;

  const x = Math.sin(dlam) * Math.cos(phi2);
  const y = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlam);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------------------
// Physics functions
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateRpmFromSpeed(speedKmh: number, gear: number, profile: MotorcycleProfile): number {
  if (speedKmh <= 0) return profile.rpm_idle;

  if (profile.transmissao === 'CVT') {
    const rpmRange = profile.rpm_max - profile.rpm_idle;
    const speedFraction = Math.min(speedKmh / 200, 1.0);
    return profile.rpm_idle + rpmRange * speedFraction;
  }

  const manualRatios = profile.gear_ratios as Record<string, number>;
  const gearKey = gear.toString();
  if (!(gearKey in manualRatios)) gear = 1;

  const gearRatio = manualRatios[gear.toString()];
  const wheelCircumference = Math.PI * profile.wheel_diameter_m;
  const finalDrive = profile.final_drive_ratio;
  const wheelAngularVel = (speedKmh * 1000 / 3600) / (wheelCircumference / 2);
  const engineRpm = wheelAngularVel * gearRatio * finalDrive * 60 / (2 * Math.PI);

  return Math.max(profile.rpm_idle, Math.min(profile.rpm_max, engineRpm));
}

function estimateGearFromSpeed(speed: number, profile: MotorcycleProfile): number {
  if (profile.transmissao === 'CVT') return 0;
  if (speed <= 0) return 1;

  let estimatedVelMax = 200;
  if (profile.rpm_max >= 15000) estimatedVelMax = 280;
  else if (profile.rpm_max >= 12000) estimatedVelMax = 200;
  else estimatedVelMax = 120;

  const speedPct = speed / estimatedVelMax;
  if (speedPct <= 0.15) return 1;
  if (speedPct <= 0.35) return 2;
  if (speedPct <= 0.60) return 3;
  if (speedPct <= 0.75) return 4;
  if (speedPct <= 0.90) return 5;
  return 6;
}

/**
 * Throttle estimation with slope awareness and cruise component.
 * Ensures coherence: constant speed → ~15-25% throttle (cruise),
 * acceleration → higher throttle, deceleration → 0%.
 */
function estimateThrottle(speed: number, prevSpeed: number, dt: number, slopeDeg: number): number {
  if (dt <= 0) return 0;

  const accelKmhs = (speed - prevSpeed) / dt; // km/h per second
  const slopeFactor = Math.sin((slopeDeg * Math.PI) / 180) * 9.81;

  // Cruise throttle: when speed is ~constant, need some throttle to maintain it
  // Higher speed → more cruise throttle needed (air resistance)
  const cruiseThrottle = speed > 3 ? clamp(15 + (speed / 200) * 25, 10, 40) : 0;

  // Uphill adds throttle, downhill subtracts
  const slopeBonus = clamp(slopeFactor * 5, -20, 30);

  if (accelKmhs > 0.5) {
    // Accelerating: cruise + acceleration component + slope
    const accelComponent = clamp((accelKmhs / 15) * 60, 0, 60);
    return clamp(cruiseThrottle + accelComponent + slopeBonus, 0, 100);
  } else if (accelKmhs < -1.0) {
    // Decelerating (braking): no throttle
    return clamp(slopeBonus, 0, 15);
  } else {
    // Cruising (±0.5 km/h/s): just maintain
    return clamp(cruiseThrottle + slopeBonus, 0, 60);
  }
}

function simulateEngineTemp(currentTemp: number, rpm: number, dt: number, profile: MotorcycleProfile): number {
  const idleTemp = profile.temp_motor_min + 5.0;
  let targetTemp: number;

  if (rpm <= profile.rpm_idle * 1.2) {
    targetTemp = idleTemp;
  } else {
    const rpmFactor = (rpm - profile.rpm_idle) / (profile.rpm_max - profile.rpm_idle);
    targetTemp = profile.temp_motor_min + rpmFactor * (profile.temp_motor_max - profile.temp_motor_min);
  }

  // Slow lerp for natural ramp-up (engine takes time to warm up)
  const lerpFactor = 0.02 * dt;
  return Math.max(20, Math.min(profile.temp_motor_max + 10, currentTemp + (targetTemp - currentTemp) * lerpFactor));
}

/**
 * Deterministic smooth voltage simulation.
 * Uses a sine wave based on timestamp for smooth variation instead of random noise.
 */
function simulateVoltage(rpm: number, timestampSec: number, profile: MotorcycleProfile): number {
  const base = profile.voltagem_nominal;
  // Smooth sine-based variation instead of random
  const wave = Math.sin(timestampSec * 0.3) * 0.15 + Math.sin(timestampSec * 0.7) * 0.05;

  if (rpm < profile.rpm_idle * 1.2) {
    return clamp(base * 0.85 + wave, profile.voltagem_min, profile.voltagem_max);
  }
  return clamp(base + wave, profile.voltagem_min, profile.voltagem_max);
}

// ---------------------------------------------------------------------------
// GPX trackpoint interface
// ---------------------------------------------------------------------------

interface GpxTrackpoint {
  lat: number;
  lon: number;
  ele: number;
  time: Date | null;
}

// ---------------------------------------------------------------------------
// GPX stats for display
// ---------------------------------------------------------------------------

export interface GpxStats {
  pointCount: number;
  durationSec: number;
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  minElevation: number;
  maxElevation: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  trackName: string;
  /** Total points in original GPX (before 10-min trim) */
  originalPointCount: number;
  /** Total duration in original GPX (before 10-min trim) */
  originalDurationSec: number;
  /** Whether the data was trimmed */
  wasTrimmed: boolean;
}

// ---------------------------------------------------------------------------
// Parse GPX XML → trackpoints
// ---------------------------------------------------------------------------

function parseGpxXml(xmlText: string): { trackpoints: GpxTrackpoint[]; trackName: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Ficheiro GPX inválido: erro ao analisar XML.");
  }

  // Get track name
  const nameEl = doc.querySelector("trk > name") ?? doc.querySelector("metadata > name");
  const trackName = nameEl?.textContent?.trim() ?? "GPX Track";

  // Get all trackpoints (handle namespace)
  const trkpts = doc.querySelectorAll("trkpt");
  if (trkpts.length === 0) {
    throw new Error("Ficheiro GPX sem trackpoints (<trkpt>).");
  }

  const trackpoints: GpxTrackpoint[] = [];

  trkpts.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute("lat") ?? "0");
    const lon = parseFloat(trkpt.getAttribute("lon") ?? "0");

    const eleEl = trkpt.querySelector("ele");
    const ele = eleEl?.textContent ? parseFloat(eleEl.textContent) : 0;

    const timeEl = trkpt.querySelector("time");
    let time: Date | null = null;
    if (timeEl?.textContent) {
      const parsed = Date.parse(timeEl.textContent);
      if (!isNaN(parsed)) time = new Date(parsed);
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      trackpoints.push({ lat, lon, ele: isNaN(ele) ? 0 : ele, time });
    }
  });

  return { trackpoints, trackName };
}

// ---------------------------------------------------------------------------
// Main: parseGPX → ParseResult (compatible with useSyncEngine)
// ---------------------------------------------------------------------------

export interface GpxParseOptions {
  motorcycleProfile?: string;
  /** Max duration in seconds (default: 600 = 10 min) */
  maxDurationSec?: number;
}

export function parseGPX(
  xmlText: string,
  options: GpxParseOptions = {}
): (ParseResult & { gpxStats: GpxStats }) | ParseError {
  const profileName = options.motorcycleProfile ?? "Naked";
  const profile = MOTORCYCLE_PROFILES[profileName] ?? MOTORCYCLE_PROFILES["Naked"];
  const maxDuration = options.maxDurationSec ?? MAX_DURATION_SEC;

  let parsed: { trackpoints: GpxTrackpoint[]; trackName: string };
  try {
    parsed = parseGpxXml(xmlText);
  } catch (err: unknown) {
    return {
      type: "EMPTY_FILE",
      message: err instanceof Error ? err.message : "Erro ao analisar GPX.",
    };
  }

  const { trackpoints: allTrackpoints, trackName } = parsed;
  const originalPointCount = allTrackpoints.length;

  if (allTrackpoints.length < 2) {
    return {
      type: "EMPTY_FILE",
      message: `GPX com apenas ${allTrackpoints.length} ponto(s), mínimo 2 necessários.`,
    };
  }

  // Check if we have timestamps
  const hasTimestamps = allTrackpoints.some((pt) => pt.time !== null);
  if (!hasTimestamps) {
    return {
      type: "NO_TIMESTAMP_COLUMN",
      message: "Ficheiro GPX sem timestamps nos trackpoints. Necessário <time> em cada <trkpt>.",
    };
  }

  // --- 10-minute cap: trim trackpoints beyond maxDuration ---
  const baseTime = allTrackpoints[0].time!;
  let originalDurationSec = 0;
  if (allTrackpoints[allTrackpoints.length - 1].time) {
    originalDurationSec = (allTrackpoints[allTrackpoints.length - 1].time!.getTime() - baseTime.getTime()) / 1000;
  }

  const trackpoints = allTrackpoints.filter((pt) => {
    if (!pt.time) return false;
    return (pt.time.getTime() - baseTime.getTime()) / 1000 <= maxDuration;
  });

  const wasTrimmed = trackpoints.length < allTrackpoints.length;

  if (trackpoints.length < 2) {
    return {
      type: "EMPTY_FILE",
      message: `Após limitação a ${maxDuration / 60} min, restam apenas ${trackpoints.length} ponto(s).`,
    };
  }

  // ---------------------------------------------------------------
  // Pass 1: Derive raw speeds from GPS (before smoothing)
  // ---------------------------------------------------------------

  interface RawPoint {
    idx: number;
    timestampSec: number;
    rawSpeedKmh: number;
    distanceM: number;
    slopeDeg: number;
    bearing: number;
    bearingChange: number;
    dt: number;
    pt: GpxTrackpoint;
    eleDiff: number;
  }

  const rawPoints: RawPoint[] = [];
  let prevBearingRaw = 0;

  for (let i = 0; i < trackpoints.length; i++) {
    const pt = trackpoints[i];
    if (!pt.time) continue;

    const timestampSec = (pt.time.getTime() - baseTime.getTime()) / 1000;
    let rawSpeedKmh = 0;
    let distanceM = 0;
    let slopeDeg = 0;
    let bearing = 0;
    let bearingChange = 0;
    let dt = 1;
    let eleDiff = 0;

    if (i > 0) {
      const prev = trackpoints[i - 1];
      if (!prev.time) continue;

      distanceM = haversineDistance(prev.lat, prev.lon, pt.lat, pt.lon);
      dt = Math.max((pt.time.getTime() - prev.time.getTime()) / 1000, 0.1);

      rawSpeedKmh = Math.min((distanceM / dt) * 3.6, 300);

      eleDiff = pt.ele - prev.ele;
      slopeDeg = distanceM > 0 ? (Math.atan2(eleDiff, distanceM) * 180) / Math.PI : 0;

      bearing = calculateBearing(prev.lat, prev.lon, pt.lat, pt.lon);
      bearingChange = bearing - prevBearingRaw;
      if (bearingChange > 180) bearingChange -= 360;
      if (bearingChange < -180) bearingChange += 360;
    }

    rawPoints.push({
      idx: i, timestampSec, rawSpeedKmh, distanceM,
      slopeDeg, bearing, bearingChange, dt, pt, eleDiff,
    });
    prevBearingRaw = bearing;
  }

  // ---------------------------------------------------------------
  // Pass 2: Smooth speeds (EMA) and build coherent telemetry
  // ---------------------------------------------------------------

  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  let smoothedSpeed = 0;
  let prevGear = 1;
  let currentTemp = profile.temp_motor_min - 10; // Start cold (below idle temp)
  let prevSmoothedSpeed = 0;

  // Stats accumulators
  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxSpeed = 0;

  for (let j = 0; j < rawPoints.length; j++) {
    const rp = rawPoints[j];

    // Exponential Moving Average for speed smoothing
    if (j === 0) {
      smoothedSpeed = rp.rawSpeedKmh;
    } else {
      smoothedSpeed = SPEED_SMOOTH_ALPHA * rp.rawSpeedKmh + (1 - SPEED_SMOOTH_ALPHA) * smoothedSpeed;
    }

    // Clamp micro-speeds to zero (< 2 km/h is GPS drift noise)
    if (smoothedSpeed < 2) smoothedSpeed = 0;

    totalDistance += rp.distanceM;
    if (rp.eleDiff > 0) elevationGain += rp.eleDiff;
    else elevationLoss += Math.abs(rp.eleDiff);
    if (smoothedSpeed > maxSpeed) maxSpeed = smoothedSpeed;

    // --- Coherent gear: max ±1 change per step ---
    const targetGear = estimateGearFromSpeed(smoothedSpeed, profile);
    let gear: number;
    if (profile.transmissao === 'CVT') {
      gear = 0;
    } else if (targetGear > prevGear) {
      gear = prevGear + 1;
    } else if (targetGear < prevGear) {
      gear = prevGear - 1;
    } else {
      gear = prevGear;
    }
    gear = clamp(gear, 1, 6);

    // RPM from smoothed speed + coherent gear
    const rpm = calculateRpmFromSpeed(smoothedSpeed, gear, profile);

    // Throttle from smoothed speed delta (coherent with speed changes)
    const throttlePct = estimateThrottle(smoothedSpeed, prevSmoothedSpeed, rp.dt, rp.slopeDeg);

    // Engine temp: natural ramp-up from cold start
    currentTemp = simulateEngineTemp(currentTemp, rpm, rp.dt, profile);

    // Voltage: smooth deterministic variation
    const voltage = simulateVoltage(rpm, rp.timestampSec, profile);

    // Acceleration (from smoothed speed, not raw)
    const accelMs2 = j > 0 ? (smoothedSpeed - prevSmoothedSpeed) / 3.6 / rp.dt : 0;
    const gForce = Math.sqrt(accelMs2 ** 2 + 9.81 ** 2) / 9.81;

    // Synthesized orientation
    const pitchDeg = clamp(rp.slopeDeg, -45, 45);
    let rollDeg = 0;
    if (smoothedSpeed > 5 && Math.abs(rp.bearingChange) > 0.5) {
      rollDeg = clamp((rp.bearingChange * smoothedSpeed) / 200, -45, 45);
    }

    const row: ParsedRow = {
      timestampSec: rp.timestampSec,
      latitude: rp.pt.lat,
      longitude: rp.pt.lon,
      speed_kmh: Math.round(smoothedSpeed * 10) / 10,
      rpm: Math.round(rpm),
      gear,
      throttle_pct: Math.round(throttlePct),
      engine_temp_c: Math.round(currentTemp),
      voltage: Math.round(voltage * 10) / 10,
      roll_deg: Math.round(rollDeg * 10) / 10,
      pitch_deg: Math.round(pitchDeg * 10) / 10,
      yaw_deg: Math.round(rp.bearing * 10) / 10,
      g_force: Math.round(gForce * 100) / 100,
    };

    rows.push(row);
    prevSmoothedSpeed = smoothedSpeed;
    prevGear = gear;
  }

  if (rows.length === 0) {
    return { type: "EMPTY_FILE", message: "Nenhum trackpoint válido encontrado no GPX." };
  }

  const durationSec = rows[rows.length - 1].timestampSec;
  const elevations = trackpoints.filter((pt) => pt.ele !== 0).map((pt) => pt.ele);

  const gpxStats: GpxStats = {
    pointCount: rows.length,
    durationSec,
    distanceKm: totalDistance / 1000,
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    minElevation: elevations.length > 0 ? Math.round(Math.min(...elevations)) : 0,
    maxElevation: elevations.length > 0 ? Math.round(Math.max(...elevations)) : 0,
    avgSpeedKmh: durationSec > 0 ? (totalDistance / 1000) / (durationSec / 3600) : 0,
    maxSpeedKmh: maxSpeed,
    trackName,
    originalPointCount,
    originalDurationSec,
    wasTrimmed,
  };

  return {
    rows,
    skippedCount,
    columns: ["lat", "lon", "ele", "time", "speed", "rpm", "gear", "throttle", "temp", "voltage"],
    durationSec,
    errors,
    format: "generic" as const,
    gpxStats,
  };
}
