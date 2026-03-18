"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialHeuristicState = createInitialHeuristicState;
exports.evaluateTelemetryRisk = evaluateTelemetryRisk;
const enums_1 = require("../generated/prisma/enums");
function createInitialHeuristicState() {
    return {
        prevPayload: null,
        gForceWindow: [],
        overheatTicks: 0,
        lowVoltageTicks: 0,
        lastEventAtByType: {},
        temps: [],
        volts: [],
        tiresFront: [],
        tiresRear: [],
    };
}
function pushLimited(arr, value, limit) {
    arr.push(value);
    if (arr.length > limit)
        arr.splice(0, arr.length - limit);
}
function mean(arr) {
    if (arr.length === 0)
        return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function slopePerSecond(values, dtSec) {
    if (values.length < 2)
        return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return (last - first) / ((values.length - 1) * dtSec);
}
function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
}
function evaluateTelemetryRisk(payload, state, profile, nowMs, dtSec) {
    const events = [];
    const speed = payload.telemetry.speed_kmh ?? 0;
    const rpm = payload.telemetry.rpm ?? 0;
    const throttle = payload.telemetry.throttle_pct ?? 0;
    const brakeFront = payload.telemetry.brake_front_pct ?? 0;
    const brakeRear = payload.telemetry.brake_rear_pct ?? 0;
    const temp = payload.telemetry.engine_temp_c ?? 0;
    const volt = payload.telemetry.voltage ?? 0;
    const roll = payload.imu.roll_deg ?? 0;
    const gForce = payload.imu.g_force ?? 0;
    const oil = payload.health.oil_pressure_bar ?? 0;
    const tireFront = payload.health.tire_pressure_front_bar ?? 0;
    const tireRear = payload.health.tire_pressure_rear_bar ?? 0;
    const prevSpeed = state.prevPayload?.telemetry?.speed_kmh ?? speed;
    const accelMs2 = ((speed - prevSpeed) / 3.6) / Math.max(dtSec, 0.001);
    const accelG = accelMs2 / 9.81;
    pushLimited(state.gForceWindow, gForce, 12);
    pushLimited(state.temps, temp, 18);
    pushLimited(state.volts, volt, 18);
    pushLimited(state.tiresFront, tireFront, 30);
    pushLimited(state.tiresRear, tireRear, 30);
    const gAvg = mean(state.gForceWindow);
    const rollAbs = Math.abs(roll);
    const shouldEmit = (type, cooldownMs) => {
        const last = state.lastEventAtByType[type] ?? 0;
        if (nowMs - last < cooldownMs)
            return false;
        state.lastEventAtByType[type] = nowMs;
        return true;
    };
    if (speed > 15 &&
        (brakeFront > 60 || brakeRear > 50) &&
        accelG < -0.35 &&
        shouldEmit(enums_1.EventType.HARD_BRAKING, 6500)) {
        const severity = accelG < -0.75 ? enums_1.EventSeverity.CRITICAL : accelG < -0.55 ? enums_1.EventSeverity.WARNING : enums_1.EventSeverity.INFO;
        events.push({
            type: enums_1.EventType.HARD_BRAKING,
            severity,
            message: `Travagem brusca (≈${Math.abs(accelG).toFixed(2)}G)`,
        });
    }
    if (speed > 10 &&
        throttle > 70 &&
        accelG > 0.30 &&
        speed < profile.maxSpeedKmh * 1.05 &&
        shouldEmit(enums_1.EventType.RAPID_ACCELERATION, 6500)) {
        const severity = accelG > 0.70 ? enums_1.EventSeverity.CRITICAL : accelG > 0.50 ? enums_1.EventSeverity.WARNING : enums_1.EventSeverity.INFO;
        events.push({
            type: enums_1.EventType.RAPID_ACCELERATION,
            severity,
            message: `Aceleração brusca (≈${Math.abs(accelG).toFixed(2)}G)`,
        });
    }
    const leanWarn = profile.typicalMaxRollDeg * 1.1;
    const leanCritical = Math.max(profile.crashRollThreshold * 0.9, profile.typicalMaxRollDeg * 1.35);
    if (speed > 25 && rollAbs > leanWarn && shouldEmit(enums_1.EventType.EXCESSIVE_LEAN, 9000)) {
        const severity = rollAbs > leanCritical ? enums_1.EventSeverity.CRITICAL : enums_1.EventSeverity.WARNING;
        events.push({
            type: enums_1.EventType.EXCESSIVE_LEAN,
            severity,
            message: `Inclinação elevada (${rollAbs.toFixed(1)}°)`,
        });
    }
    if (gForce > Math.max(1.9, gAvg + 0.65) && speed > 8 && rollAbs < 20 && shouldEmit(enums_1.EventType.HIGH_VIBRATION, 8000)) {
        const severity = gForce > 3.0 ? enums_1.EventSeverity.CRITICAL : gForce > 2.3 ? enums_1.EventSeverity.WARNING : enums_1.EventSeverity.INFO;
        events.push({
            type: enums_1.EventType.HIGH_VIBRATION,
            severity,
            message: `Vibração anómala (G=${gForce.toFixed(2)})`,
        });
    }
    if (temp >= profile.criticalTemp)
        state.overheatTicks += 1;
    else
        state.overheatTicks = 0;
    if (state.overheatTicks === 3 && shouldEmit(enums_1.EventType.OVERHEAT, 12000)) {
        events.push({
            type: enums_1.EventType.OVERHEAT,
            severity: enums_1.EventSeverity.WARNING,
            message: `Temperatura acima do limiar (${temp.toFixed(1)}°C)`,
        });
    }
    if (state.overheatTicks >= 8 && shouldEmit(enums_1.EventType.OVERHEAT, 12000)) {
        events.push({
            type: enums_1.EventType.OVERHEAT,
            severity: enums_1.EventSeverity.CRITICAL,
            message: `Sobreaquecimento persistente (${temp.toFixed(1)}°C)`,
        });
    }
    if (volt <= profile.criticalVoltage)
        state.lowVoltageTicks += 1;
    else
        state.lowVoltageTicks = 0;
    if (state.lowVoltageTicks === 3 && shouldEmit(enums_1.EventType.LOW_VOLTAGE, 12000)) {
        events.push({
            type: enums_1.EventType.LOW_VOLTAGE,
            severity: enums_1.EventSeverity.WARNING,
            message: `Voltagem baixa (${volt.toFixed(1)}V)`,
        });
    }
    if (state.lowVoltageTicks >= 8 && shouldEmit(enums_1.EventType.LOW_VOLTAGE, 12000)) {
        events.push({
            type: enums_1.EventType.LOW_VOLTAGE,
            severity: enums_1.EventSeverity.CRITICAL,
            message: `Falha de carregamento provável (${volt.toFixed(1)}V)`,
        });
    }
    if (oil > 0 && speed > 25 && oil < 0.9 && shouldEmit(enums_1.EventType.OIL_PRESSURE_LOW, 15000)) {
        const severity = oil < 0.6 ? enums_1.EventSeverity.CRITICAL : enums_1.EventSeverity.WARNING;
        events.push({
            type: enums_1.EventType.OIL_PRESSURE_LOW,
            severity,
            message: `Pressão de óleo baixa (${oil.toFixed(1)} bar)`,
        });
    }
    if ((tireFront > 0 && tireFront < 1.3) ||
        (tireRear > 0 && tireRear < 1.3)) {
        if (shouldEmit(enums_1.EventType.TIRE_PRESSURE_LOW, 20000)) {
            const minTire = Math.min(tireFront || 99, tireRear || 99);
            const severity = minTire < 1.05 ? enums_1.EventSeverity.CRITICAL : enums_1.EventSeverity.WARNING;
            events.push({
                type: enums_1.EventType.TIRE_PRESSURE_LOW,
                severity,
                message: `Pressão de pneus baixa (F=${tireFront.toFixed(2)} / R=${tireRear.toFixed(2)} bar)`,
            });
        }
    }
    const tempSlope = slopePerSecond(state.temps, dtSec);
    if (tempSlope > 0.02 && temp < profile.criticalTemp && shouldEmit(enums_1.EventType.OVERHEAT, 25000)) {
        const secondsToCritical = (profile.criticalTemp - temp) / Math.max(tempSlope, 0.0001);
        if (Number.isFinite(secondsToCritical) && secondsToCritical < 900) {
            const minutes = clamp(secondsToCritical / 60, 1, 999);
            events.push({
                type: enums_1.EventType.OVERHEAT,
                severity: enums_1.EventSeverity.INFO,
                message: `Tendência de temperatura: possível limiar em ~${Math.round(minutes)} min`,
            });
        }
    }
    const voltSlope = slopePerSecond(state.volts, dtSec);
    if (voltSlope < -0.01 && volt > profile.criticalVoltage && shouldEmit(enums_1.EventType.LOW_VOLTAGE, 25000)) {
        const secondsToCritical = (profile.criticalVoltage - volt) / Math.min(voltSlope, -0.0001);
        if (Number.isFinite(secondsToCritical) && secondsToCritical < 900) {
            const minutes = clamp(secondsToCritical / 60, 1, 999);
            events.push({
                type: enums_1.EventType.LOW_VOLTAGE,
                severity: enums_1.EventSeverity.INFO,
                message: `Tendência de voltagem: possível limiar em ~${Math.round(minutes)} min`,
            });
        }
    }
    const frontSlope = slopePerSecond(state.tiresFront, dtSec);
    const rearSlope = slopePerSecond(state.tiresRear, dtSec);
    if ((frontSlope < -0.0003 || rearSlope < -0.0003) && shouldEmit(enums_1.EventType.TIRE_PRESSURE_LOW, 30000)) {
        events.push({
            type: enums_1.EventType.TIRE_PRESSURE_LOW,
            severity: enums_1.EventSeverity.INFO,
            message: "Tendência de pressão: possível perda lenta",
        });
    }
    state.prevPayload = payload;
    return { events };
}
//# sourceMappingURL=heuristics.service.js.map