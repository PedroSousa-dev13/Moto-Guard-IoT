// =============================================================================
// MotoGuard IoT — Telemetry_Emitter
// =============================================================================
// Constrói TelemetryPayload a partir de uma ParsedRow e emite via Socket.IO.
// Módulo puro (buildPayload) + side-effect isolado (emitTelemetry).
// =============================================================================

import type { Socket } from "socket.io-client";
import type { TelemetryPayload } from "../types/telemetry";
import type { ParsedRow } from "./csvParser";

/**
 * Constrói um TelemetryPayload completo a partir de uma linha CSV parseada.
 *
 * @param row                - Linha CSV normalizada
 * @param deviceId           - Device ID configurado pelo utilizador
 * @param simulationStartTime - Momento de início da simulação (para calcular timestamp absoluto)
 * @param eventStatus        - "TRIP_ACTIVE" durante reprodução, "TRIP_ENDED" no stop
 * @param tick               - Índice da linha CSV atual (default: row.timestampSec arredondado)
 */
export function buildPayload(
  row: ParsedRow,
  deviceId: string,
  simulationStartTime: Date,
  eventStatus: string,
  tick: number = 0
): TelemetryPayload {
  // system.timestamp = simulationStartTime + row.timestampSec * 1000ms (ISO 8601)
  const absoluteMs = simulationStartTime.getTime() + row.timestampSec * 1000;
  const timestamp = new Date(absoluteMs).toISOString();

  return {
    telemetry: {
      speed_kmh: row.speed_kmh,
      rpm: row.rpm,
      gear: row.gear,
      throttle_pct: row.throttle_pct,
      engine_temp_c: row.engine_temp_c,
      voltage: row.voltage,
      brake_front_pct: 0,
      brake_rear_pct: 0,
      odometer_km: 0,
      clutch_engaged: false,
    },
    imu: {
      roll_deg: row.roll_deg,
      pitch_deg: row.pitch_deg,
      yaw_deg: row.yaw_deg,
      g_force: row.g_force,
    },
    active_safety: {
      abs_active: false,
      tc_active: false,
    },
    health: {
      oil_pressure_bar: 3.5,
      tire_pressure_front_bar: 2.4,
      tire_pressure_rear_bar: 2.2,
    },
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
    },
    system: {
      device_id: deviceId,
      moto_model: "Real Simulator",
      event_status: eventStatus,
      tick,
      timestamp,
    },
  };
}

/**
 * Emite um TelemetryPayload via Socket.IO no evento `telemetry_update`.
 *
 * @param socket  - Instância Socket.IO conectada
 * @param payload - Payload a emitir
 */
export function emitTelemetry(socket: Socket, payload: TelemetryPayload): void {
  socket.emit("telemetry_update", payload);
}
