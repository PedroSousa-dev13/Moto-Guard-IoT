// =============================================================================
// MotoGuard IoT — Validação do Payload de Telemetria
// =============================================================================
// Valida a estrutura do JSON recebido via MQTT antes de o aceitar.
// Garante que os 7 blocos obrigatórios existem e contêm os campos esperados.
// =============================================================================

import type { TelemetryPayload } from "../models/telemetry.model";

/** Resultado da validação */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Verifica se um valor é um objecto não-nulo */
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Verifica se todos os campos indicados existem no objecto */
function hasFields(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    if (obj[f] === undefined) return f;
  }
  return null;
}

/**
 * Valida a estrutura do payload de telemetria recebido do simulador.
 * Não valida tipos individuais — apenas presença dos blocos e campos.
 */
export function validateTelemetryPayload(data: unknown): ValidationResult {
  if (!isObj(data)) {
    return { valid: false, error: "Payload não é um objecto JSON válido" };
  }

  // ─── Blocos obrigatórios ──────────────────────────────────────────────
  const requiredBlocks = [
    "telemetry",
    "imu",
    "active_safety",
    "health",
    "location",
    "system",
  ];

  for (const block of requiredBlocks) {
    if (!isObj(data[block])) {
      return { valid: false, error: `Bloco '${block}' em falta ou inválido` };
    }
  }

  // ─── Campos dentro de cada bloco ──────────────────────────────────────
  const telemetry = data.telemetry as Record<string, unknown>;
  const missing = hasFields(telemetry, [
    "speed_kmh",
    "rpm",
    "gear",
    "throttle_pct",
    "engine_temp_c",
    "voltage",
  ]);
  if (missing) {
    return { valid: false, error: `Campo 'telemetry.${missing}' em falta` };
  }

  const imu = data.imu as Record<string, unknown>;
  const imuMissing = hasFields(imu, ["roll_deg", "pitch_deg", "yaw_deg", "g_force"]);
  if (imuMissing) {
    return { valid: false, error: `Campo 'imu.${imuMissing}' em falta` };
  }

  const location = data.location as Record<string, unknown>;
  const locMissing = hasFields(location, ["latitude", "longitude"]);
  if (locMissing) {
    return { valid: false, error: `Campo 'location.${locMissing}' em falta` };
  }

  const system = data.system as Record<string, unknown>;
  const sysMissing = hasFields(system, ["device_id", "moto_model", "timestamp"]);
  if (sysMissing) {
    return { valid: false, error: `Campo 'system.${sysMissing}' em falta` };
  }

  // Validar que o timestamp é uma data ISO 8601 válida
  const ts = system.timestamp;
  if (typeof ts !== "string" || Number.isNaN(new Date(ts).getTime())) {
    return { valid: false, error: "Campo 'system.timestamp' não é uma data ISO 8601 válida" };
  }

  return { valid: true };
}
