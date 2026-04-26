"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const heuristics_service_1 = require("./heuristics.service");
const enums_1 = require("../generated/prisma/enums");
(0, vitest_1.describe)('HeuristicsService', () => {
    let profile;
    let state;
    (0, vitest_1.beforeEach)(() => {
        profile = {
            maxSpeedKmh: 200,
            typicalMaxRollDeg: 40,
            crashRollThreshold: 70,
            crashGForce: 2.5,
            criticalTemp: 100,
            criticalVoltage: 11.5,
            criticalRpm: 10000,
        };
        state = (0, heuristics_service_1.createInitialHeuristicState)();
    });
    const createPayload = (overrides = {}) => {
        const base = {
            system: { device_id: 'test', moto_model: 'test', timestamp: new Date().toISOString(), event_status: 'NORMAL', speed_limit_kmh: 0 },
            telemetry: { speed_kmh: 0, rpm: 0, gear: 0, throttle_pct: 0, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
            imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
            location: { latitude: 0, longitude: 0 },
            health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.5 }
        };
        return {
            ...base,
            ...overrides,
            system: { ...base.system, ...(overrides.system || {}) },
            telemetry: { ...base.telemetry, ...(overrides.telemetry || {}) },
            imu: { ...base.imu, ...(overrides.imu || {}) }
        };
    };
    (0, vitest_1.it)('should detect HARD_BRAKING', () => {
        state.prevPayload = createPayload({ telemetry: { speed_kmh: 100 } });
        const payload = createPayload({
            telemetry: { speed_kmh: 50, brake_front_pct: 80, brake_rear_pct: 0 }
        });
        // dtSec = 1s. Speed diff = 50kmh = 13.8m/s. accel = -13.8m/s2. accelG = -1.4G
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.HARD_BRAKING,
            severity: enums_1.EventSeverity.CRITICAL
        }));
    });
    (0, vitest_1.it)('should detect RAPID_ACCELERATION', () => {
        state.prevPayload = createPayload({ telemetry: { speed_kmh: 10 } });
        const payload = createPayload({
            telemetry: { speed_kmh: 60, throttle_pct: 90 }
        });
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.RAPID_ACCELERATION,
            severity: enums_1.EventSeverity.CRITICAL
        }));
    });
    (0, vitest_1.it)('should detect EXCESSIVE_LEAN', () => {
        const payload = createPayload({
            telemetry: { speed_kmh: 60 },
            imu: { roll_deg: 50 }
        });
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.EXCESSIVE_LEAN
        }));
    });
    (0, vitest_1.it)('should detect OVERHEAT after multiple ticks', () => {
        const payload = createPayload({
            telemetry: { engine_temp_c: 105 } // profile.criticalTemp = 100
        });
        // 30 ticks for WARNING
        for (let i = 0; i < 29; i++)
            (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + i * 100, 0.1);
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + 3000, 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.OVERHEAT,
            severity: enums_1.EventSeverity.WARNING
        }));
    });
    (0, vitest_1.it)('should detect LOW_VOLTAGE after multiple ticks', () => {
        const payload = createPayload({
            telemetry: { voltage: 11.0 } // profile.criticalVoltage = 11.5
        });
        for (let i = 0; i < 29; i++)
            (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + i * 100, 0.1);
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + 3000, 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.LOW_VOLTAGE,
            severity: enums_1.EventSeverity.WARNING
        }));
    });
    (0, vitest_1.it)('should detect SPEEDING', () => {
        const payload = createPayload({
            system: { speed_limit_kmh: 50 },
            telemetry: { speed_kmh: 80 }
        });
        // 30 ticks
        for (let i = 0; i < 29; i++)
            (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + i * 100, 0.1);
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + 3000, 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.SPEEDING,
            severity: enums_1.EventSeverity.CRITICAL
        }));
    });
    (0, vitest_1.it)('should detect ENGINE_OVERREV', () => {
        const payload = createPayload({
            telemetry: { rpm: 11000 } // thresholds.criticalRpm = 10000
        });
        // 15 ticks
        for (let i = 0; i < 14; i++)
            (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + i * 100, 0.1);
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now() + 1500, 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.ENGINE_OVERREV
        }));
    });
    (0, vitest_1.it)('should detect WHEELIE_DETECTED', () => {
        const payload = createPayload({
            telemetry: { speed_kmh: 40 },
            imu: { pitch_deg: 20 } // > 15
        });
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.WHEELIE_DETECTED,
            severity: enums_1.EventSeverity.WARNING
        }));
    });
    (0, vitest_1.it)('should detect STOPPIE_DETECTED', () => {
        const payload = createPayload({
            telemetry: { speed_kmh: 40 },
            imu: { pitch_deg: -20 } // < -15
        });
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.STOPPIE_DETECTED,
            severity: enums_1.EventSeverity.WARNING
        }));
    });
    (0, vitest_1.it)('should detect SAFETY_SYSTEM_ACTIVE', () => {
        const payload = createPayload({
            active_safety: { abs_active: true }
        });
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, profile, Date.now(), 0.1);
        (0, vitest_1.expect)(result.events).toContainEqual(vitest_1.expect.objectContaining({
            type: enums_1.EventType.SAFETY_SYSTEM_ACTIVE
        }));
    });
});
//# sourceMappingURL=heuristics.service.test.js.map