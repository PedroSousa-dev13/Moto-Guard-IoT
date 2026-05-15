import { describe, it, expect } from 'vitest';
import { validateTelemetryPayload } from './validate-telemetry';

describe('ValidateTelemetryUtility', () => {
  const validPayload = {
    telemetry: { speed_kmh: 0, rpm: 0, gear: 0, throttle_pct: 0, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
    imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
    active_safety: { abs_active: false, tc_active: false },
    health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.5 },
    location: { latitude: 0, longitude: 0 },
    system: { device_id: 'test', moto_model: 'test', timestamp: '2026-04-22T00:00:00Z' }
  };

  it('should validate a correct payload', () => {
    const result = validateTelemetryPayload(validPayload);
    expect(result.valid).toBe(true);
  });

  it('should fail if payload is not an object', () => {
    const result = validateTelemetryPayload("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não é um objecto');
  });

  it('should fail if a block is missing', () => {
    const invalid = { ...validPayload };
    delete (invalid as any).telemetry;
    const result = validateTelemetryPayload(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Bloco 'telemetry' em falta");
  });

  it('should fail if a required field inside a block is missing', () => {
    const invalid = JSON.parse(JSON.stringify(validPayload));
    delete invalid.telemetry.speed_kmh;
    const result = validateTelemetryPayload(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Campo 'telemetry.speed_kmh' em falta");
  });
});
