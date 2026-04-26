"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const heuristics_service_1 = require("../services/heuristics.service");
const enums_1 = require("../generated/prisma/enums");
(0, vitest_1.describe)('Heuristics Engine (10Hz)', () => {
    const profile = {
        maxSpeedKmh: 200,
        typicalMaxRollDeg: 45,
        crashRollThreshold: 60,
        crashGForce: 2.5,
        criticalTemp: 105,
        criticalVoltage: 11.8
    };
    const dtSec = 0.1; // 10Hz
    (0, vitest_1.it)('deve detetar uma travagem brusca', () => {
        const state = (0, heuristics_service_1.createInitialHeuristicState)();
        const now = Date.now();
        // Payload 1: 100 km/h
        const p1 = createMockPayload(100, 0, 0, 0);
        (0, heuristics_service_1.evaluateTelemetryRisk)(p1, state, profile, now, dtSec);
        // Payload 2: 70 km/h (desaceleração massiva em 0.1s)
        const p2 = createMockPayload(70, 0, 80, 0); // Travão frente 80%
        const result = (0, heuristics_service_1.evaluateTelemetryRisk)(p2, state, profile, now + 100, dtSec);
        const event = result.events.find(e => e.type === enums_1.EventType.HARD_BRAKING);
        (0, vitest_1.expect)(event).toBeDefined();
        (0, vitest_1.expect)(event?.severity).toBe(enums_1.EventSeverity.CRITICAL);
    });
    (0, vitest_1.it)('deve esperar 30 ticks (3s) para alerta de sobreaquecimento', () => {
        const state = (0, heuristics_service_1.createInitialHeuristicState)();
        let now = Date.now();
        let result;
        // Simular 29 ticks de calor
        for (let i = 0; i < 29; i++) {
            const p = createMockPayload(50, 110, 0, 0); // 110°C (critico)
            result = (0, heuristics_service_1.evaluateTelemetryRisk)(p, state, profile, now, dtSec);
            now += 100;
            (0, vitest_1.expect)(result.events.length).toBe(0); // Ainda não deve haver evento
        }
        // Tick 30
        const p30 = createMockPayload(50, 110, 0, 0);
        result = (0, heuristics_service_1.evaluateTelemetryRisk)(p30, state, profile, now, dtSec);
        const event = result.events.find(e => e.type === enums_1.EventType.OVERHEAT);
        (0, vitest_1.expect)(event).toBeDefined();
        (0, vitest_1.expect)(event?.severity).toBe(enums_1.EventSeverity.WARNING);
    });
});
function createMockPayload(speed, temp, brakeFront, roll) {
    return {
        telemetry: {
            speed_kmh: speed,
            engine_temp_c: temp,
            brake_front_pct: brakeFront,
            rpm: 3000,
            voltage: 14.0
        },
        imu: {
            roll_deg: roll,
            g_force: 1.0
        },
        health: {},
        system: { device_id: 'test' },
        location: { latitude: 0, longitude: 0 }
    };
}
//# sourceMappingURL=heuristics.test.js.map