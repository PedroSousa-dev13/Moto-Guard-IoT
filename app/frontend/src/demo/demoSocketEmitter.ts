// =============================================================================
// MotoGuard IoT — DemoSocketEmitter
// =============================================================================
// Emula os eventos do Socket.IO real para o hook useSocket em modo demo.
// Não usa Node.js EventEmitter — implementa a interface on/emit/off diretamente
// para compatibilidade com o browser.
// =============================================================================

import type { TelemetryPayload } from "../types/telemetry";

type Listener = (...args: unknown[]) => void;

export class DemoSocketEmitter {
  private listeners: Map<string, Listener[]> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tripTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private tick = 0;
  private odometer = 0;

  // ── Minimal EventEmitter interface ──────────────────────────────────────
  on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: Listener): this {
    const arr = this.listeners.get(event);
    if (arr) {
      this.listeners.set(event, arr.filter((l) => l !== listener));
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const arr = this.listeners.get(event);
    if (arr) {
      arr.forEach((l) => l(...args));
    }
    return this;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Inicia a emissão de eventos demo.
   * Idempotente: limpa intervalos anteriores antes de criar novos.
   */
  start(): void {
    // Idempotent — clear any existing timers first
    this._clearTimers();

    // Task 4.2 — emit connect and status immediately
    this.emit("connect");
    this.emit("status", { mqttConnected: true, hasData: true, telemetryCount: 0 });

    // Task 4.2 — start telemetry interval at 1500ms
    this.intervalId = setInterval(() => {
      this.tick++;
      this.odometer += 0.0004;
      this.emit("telemetry_update", this._buildTelemetry());
    }, 1500);

    // Task 4.4 — emit trip_started after 3000ms
    this.tripTimeoutId = setTimeout(() => {
      this.emit("trip_started", {
        deviceId: "DEMO-DEVICE-001",
        motoModel: "Honda CB650R Demo",
        timestamp: new Date().toISOString(),
      });
    }, 3000);
  }

  /**
   * Para todos os intervalos e timeouts. Idempotente.
   */
  stop(): void {
    this._clearTimers();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _clearTimers(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.tripTimeoutId !== null) {
      clearTimeout(this.tripTimeoutId);
      this.tripTimeoutId = null;
    }
  }

  /**
   * Task 4.3 — Build a TelemetryPayload with oscillating values.
   */
  private _buildTelemetry(): TelemetryPayload {
    const t = this.tick;

    // Oscillating values
    const speed_kmh = 40 + 60 * Math.abs(Math.sin(t * 0.15));
    const rpm = 2000 + 4000 * Math.abs(Math.sin(t * 0.12));
    const roll_deg = 35 * Math.sin(t * 0.2);
    const g_force = 1.0 + 0.8 * Math.abs(Math.sin(t * 0.18));
    const gear = Math.min(6, Math.max(1, Math.ceil(speed_kmh / 20)));

    // Lisbon base coordinates with small drift
    const latitude = 38.7169 + Math.sin(t * 0.05) * 0.002;
    const longitude = -9.1399 + Math.cos(t * 0.05) * 0.002;

    return {
      telemetry: {
        speed_kmh,
        rpm,
        gear,
        throttle_pct: Math.min(100, Math.max(0, 30 + 50 * Math.abs(Math.sin(t * 0.13)))),
        engine_temp_c: 85 + 15 * Math.abs(Math.sin(t * 0.07)),
        voltage: 12.5 + 0.5 * Math.sin(t * 0.1),
        brake_front_pct: Math.max(0, 20 * Math.sin(t * 0.25)),
        brake_rear_pct: Math.max(0, 15 * Math.sin(t * 0.22)),
        odometer_km: this.odometer,
        clutch_engaged: (t % 8) < 1,
      },
      imu: {
        roll_deg,
        pitch_deg: 5 * Math.sin(t * 0.17),
        yaw_deg: t * 2.5 % 360,
        g_force,
      },
      active_safety: {
        abs_active: false,
        tc_active: false,
      },
      health: {
        oil_pressure_bar: 3.5 + 0.3 * Math.sin(t * 0.08),
        tire_pressure_front_bar: 2.4 + 0.05 * Math.sin(t * 0.06),
        tire_pressure_rear_bar: 2.2 + 0.05 * Math.cos(t * 0.06),
      },
      location: {
        latitude,
        longitude,
      },
      system: {
        device_id: "DEMO-DEVICE-001",
        moto_model: "Honda CB650R Demo",
        event_status: "TRIP_ACTIVE",
        tick: t,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
