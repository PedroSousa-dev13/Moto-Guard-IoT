import { describe, it, expect } from "vitest";
import { validateTelemetryPayload } from "../backend/src/utils/validate-telemetry";

function buildValidPayload() {
  return {
    telemetry: {
      speed_kmh: 0,
      rpm: 0,
      gear: 0,
      throttle_pct: 0,
      engine_temp_c: 0,
      voltage: 12.4,
    },
    imu: {
      roll_deg: 0,
      pitch_deg: 0,
      yaw_deg: 0,
      g_force: 1,
    },
    active_safety: {},
    health: {},
    location: {
      latitude: 0,
      longitude: 0,
    },
    environment: {},
    system: {
      device_id: "dev-1",
      moto_model: "Naked",
      timestamp: "2026-03-16T10:00:00.000Z",
    },
  };
}

describe("validateTelemetryPayload", () => {
  it("returns valid true for a complete payload", () => {
    const payload = buildValidPayload();

    const result = validateTelemetryPayload(payload);

    expect(result).toEqual({ valid: true });
  });

  it("returns invalid for non-object payload", () => {
    const payload = "invalid-json-like-input";

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Payload não é um objecto JSON válido");
  });

  it("returns invalid when a required block is missing", () => {
    const payload = buildValidPayload();
    delete (payload as Record<string, unknown>).health;

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Bloco 'health' em falta ou inválido");
  });

  it("returns invalid when telemetry field is missing", () => {
    const payload = buildValidPayload();
    delete (payload.telemetry as Record<string, unknown>).rpm;

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Campo 'telemetry.rpm' em falta");
  });

  it("returns invalid when imu field is missing", () => {
    const payload = buildValidPayload();
    delete (payload.imu as Record<string, unknown>).yaw_deg;

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Campo 'imu.yaw_deg' em falta");
  });

  it("returns invalid when location field is missing", () => {
    const payload = buildValidPayload();
    delete (payload.location as Record<string, unknown>).latitude;

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Campo 'location.latitude' em falta");
  });

  it("returns invalid when system field is missing", () => {
    const payload = buildValidPayload();
    delete (payload.system as Record<string, unknown>).timestamp;

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Campo 'system.timestamp' em falta");
  });

  it("returns invalid when required block is an array", () => {
    const payload = buildValidPayload();
    (payload as Record<string, unknown>).health = [];

    const result = validateTelemetryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Bloco 'health' em falta ou inválido");
  });

  it("accepts null values for present keys because only presence is validated", () => {
    const payload = buildValidPayload();
    payload.telemetry.speed_kmh = null as unknown as number;
    payload.system.timestamp = null as unknown as string;

    const result = validateTelemetryPayload(payload);

    expect(result).toEqual({ valid: true });
  });
});
