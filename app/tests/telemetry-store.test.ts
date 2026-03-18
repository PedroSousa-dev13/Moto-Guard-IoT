import { describe, it, expect, beforeEach, vi } from "vitest";

async function loadStore() {
  vi.resetModules();
  const mod = await import("../backend/src/services/telemetry.store");
  return mod.telemetryStore;
}

describe("telemetryStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with no data and zero count", async () => {
    const store = await loadStore();

    expect(store.latest).toBeNull();
    expect(store.count).toBe(0);
    expect(store.hasData).toBe(false);
  });

  it("updates latest payload and increments count", async () => {
    const store = await loadStore();
    const payload = {
      telemetry: {
        speed_kmh: 40,
        rpm: 3000,
        gear: 3,
        throttle_pct: 40,
        engine_temp_c: 85,
        voltage: 13.8,
      },
      imu: { roll_deg: 5, pitch_deg: 2, yaw_deg: 90, g_force: 1.1 },
      active_safety: { abs_active: false, tcs_active: false },
      health: { battery_low: false, engine_fault: false },
      location: { latitude: 41.3, longitude: -7.7 },
      environment: { ambient_temp_c: 23, rain_level: 0 },
      system: {
        timestamp: "2026-03-16T10:00:00.000Z",
        device_id: "dev-7",
        moto_model: "Trail",
        event_status: "normal",
      },
    } as any;

    store.update(payload);

    expect(store.latest).toEqual(payload);
    expect(store.count).toBe(1);
    expect(store.hasData).toBe(true);
  });

  it("preserves only latest payload after multiple updates", async () => {
    const store = await loadStore();
    const first = {
      telemetry: {
        speed_kmh: 10,
        rpm: 1000,
        gear: 1,
        throttle_pct: 10,
        engine_temp_c: 70,
        voltage: 12.5,
      },
      imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1 },
      active_safety: {},
      health: {},
      location: { latitude: 0, longitude: 0 },
      environment: {},
      system: { timestamp: "a", device_id: "d1", moto_model: "A" },
    } as any;
    const second = {
      ...first,
      telemetry: { ...first.telemetry, speed_kmh: 80, rpm: 6000 },
      system: { timestamp: "b", device_id: "d1", moto_model: "B" },
    } as any;

    store.update(first);
    store.update(second);

    expect(store.latest).toEqual(second);
    expect(store.count).toBe(2);
  });

  it("returns status snapshot with mqtt connectivity", async () => {
    const store = await loadStore();
    const payload = {
      telemetry: {
        speed_kmh: 30,
        rpm: 2000,
        gear: 2,
        throttle_pct: 20,
        engine_temp_c: 75,
        voltage: 12.9,
      },
      imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1 },
      active_safety: {},
      health: {},
      location: { latitude: 1, longitude: 1 },
      environment: {},
      system: { timestamp: "c", device_id: "d2", moto_model: "Naked" },
    } as any;
    store.update(payload);

    const status = store.getStatus(true);

    expect(status).toEqual({
      mqttConnected: true,
      telemetryCount: 1,
      hasData: true,
    });
  });
});
