"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const validate_telemetry_1 = require("./validate-telemetry");
(0, vitest_1.describe)('ValidateTelemetryUtility', () => {
    const validPayload = {
        telemetry: { speed_kmh: 0, rpm: 0, gear: 0, throttle_pct: 0, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
        imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
        active_safety: {},
        health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.5 },
        location: { latitude: 0, longitude: 0 },
        system: { device_id: 'test', moto_model: 'test', timestamp: '2026-04-22T00:00:00Z' }
    };
    (0, vitest_1.it)('should validate a correct payload', () => {
        const result = (0, validate_telemetry_1.validateTelemetryPayload)(validPayload);
        (0, vitest_1.expect)(result.valid).toBe(true);
    });
    (0, vitest_1.it)('should fail if payload is not an object', () => {
        const result = (0, validate_telemetry_1.validateTelemetryPayload)("not-an-object");
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('não é um objecto');
    });
    (0, vitest_1.it)('should fail if a block is missing', () => {
        const invalid = { ...validPayload };
        delete invalid.telemetry;
        const result = (0, validate_telemetry_1.validateTelemetryPayload)(invalid);
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain("Bloco 'telemetry' em falta");
    });
    (0, vitest_1.it)('should fail if a required field inside a block is missing', () => {
        const invalid = JSON.parse(JSON.stringify(validPayload));
        delete invalid.telemetry.speed_kmh;
        const result = (0, validate_telemetry_1.validateTelemetryPayload)(invalid);
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error).toContain("Campo 'telemetry.speed_kmh' em falta");
    });
});
//# sourceMappingURL=validate-telemetry.test.js.map