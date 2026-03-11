"use strict";
// =============================================================================
// MotoGuard IoT — Validação do Payload de Telemetria
// =============================================================================
// Valida a estrutura do JSON recebido via MQTT antes de o aceitar.
// Garante que os blocos obrigatórios existem e contêm os campos esperados.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelemetryPayload = validateTelemetryPayload;
/** Verifica se um valor é um objecto não-nulo */
function isObj(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** Verifica se todos os campos indicados existem no objecto */
function hasFields(obj, fields) {
    for (const f of fields) {
        if (obj[f] === undefined)
            return f;
    }
    return null;
}
/**
 * Valida a estrutura do payload de telemetria recebido do simulador.
 * Não valida tipos individuais — apenas presença dos blocos e campos.
 */
function validateTelemetryPayload(data) {
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
    const telemetry = data.telemetry;
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
    const imu = data.imu;
    const imuMissing = hasFields(imu, ["roll_deg", "pitch_deg", "yaw_deg", "g_force"]);
    if (imuMissing) {
        return { valid: false, error: `Campo 'imu.${imuMissing}' em falta` };
    }
    const location = data.location;
    const locMissing = hasFields(location, ["latitude", "longitude"]);
    if (locMissing) {
        return { valid: false, error: `Campo 'location.${locMissing}' em falta` };
    }
    const system = data.system;
    const sysMissing = hasFields(system, ["device_id", "moto_model", "timestamp"]);
    if (sysMissing) {
        return { valid: false, error: `Campo 'system.${sysMissing}' em falta` };
    }
    return { valid: true };
}
//# sourceMappingURL=validate-telemetry.js.map