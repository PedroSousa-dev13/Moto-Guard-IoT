import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialHeuristicState, evaluateTelemetryRisk, type MotorcycleProfileThresholds, type HeuristicState } from './heuristics.service';
import { EventType, EventSeverity } from '../generated/prisma/enums';

describe('HeuristicsService', () => {
  let profile: MotorcycleProfileThresholds;
  let state: HeuristicState;

  beforeEach(() => {
    profile = {
      maxSpeedKmh: 200,
      typicalMaxRollDeg: 40,
      crashRollThreshold: 70,
      crashGForce: 2.5,
      criticalTemp: 100,
      criticalVoltage: 11.5,
    };
    state = createInitialHeuristicState();
  });

  const createPayload = (overrides: any = {}): any => ({
    system: { device_id: 'test', moto_model: 'test', timestamp: new Date().toISOString(), event_status: 'NORMAL' },
    telemetry: { speed_kmh: 0, rpm: 0, gear: 0, throttle_pct: 0, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
    imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
    location: { latitude: 0, longitude: 0 },
    health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.5 },
    ...overrides
  });

  it('should detect HARD_BRAKING', () => {
    state.prevPayload = createPayload({ telemetry: { speed_kmh: 100 } });
    const payload = createPayload({
      telemetry: { speed_kmh: 50, brake_front_pct: 80, brake_rear_pct: 0 }
    });
    
    // dtSec = 1s. Speed diff = 50kmh = 13.8m/s. accel = -13.8m/s2. accelG = -1.4G
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.HARD_BRAKING,
      severity: EventSeverity.CRITICAL
    }));
  });

  it('should detect RAPID_ACCELERATION', () => {
    state.prevPayload = createPayload({ telemetry: { speed_kmh: 10 } });
    const payload = createPayload({
      telemetry: { speed_kmh: 60, throttle_pct: 90 }
    });
    
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.RAPID_ACCELERATION,
      severity: EventSeverity.CRITICAL
    }));
  });

  it('should detect EXCESSIVE_LEAN', () => {
    const payload = createPayload({
      telemetry: { speed_kmh: 60 },
      imu: { roll_deg: 50 }
    });
    
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.EXCESSIVE_LEAN
    }));
  });

  it('should detect OVERHEAT after multiple ticks', () => {
    const payload = createPayload({
      telemetry: { engine_temp_c: 105 } // profile.criticalTemp = 100
    });
    
    // 3 ticks for WARNING
    evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    evaluateTelemetryRisk(payload, state, profile, Date.now() + 1000, 1);
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now() + 2000, 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.OVERHEAT,
      severity: EventSeverity.WARNING
    }));
  });

  it('should detect LOW_VOLTAGE after multiple ticks', () => {
    const payload = createPayload({
      telemetry: { voltage: 11.0 } // profile.criticalVoltage = 11.5
    });
    
    evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    evaluateTelemetryRisk(payload, state, profile, Date.now() + 1000, 1);
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now() + 2000, 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.LOW_VOLTAGE,
      severity: EventSeverity.WARNING
    }));
  });

  it('should detect SPEEDING', () => {
    const payload = createPayload({
      system: { speed_limit_kmh: 50 },
      telemetry: { speed_kmh: 80 }
    });
    
    // 3 ticks
    evaluateTelemetryRisk(payload, state, profile, Date.now(), 1);
    evaluateTelemetryRisk(payload, state, profile, Date.now() + 1000, 1);
    const result = evaluateTelemetryRisk(payload, state, profile, Date.now() + 2000, 1);
    
    expect(result.events).toContainEqual(expect.objectContaining({
      type: EventType.SPEEDING,
      severity: EventSeverity.CRITICAL
    }));
  });
});
