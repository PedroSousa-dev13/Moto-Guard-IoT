"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateTripHeuristic = evaluateTripHeuristic;
const enums_1 = require("../generated/prisma/enums");
function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
}
function evaluateTripHeuristic(input) {
    const severityCounts = {
        INFO: 0,
        WARNING: 0,
        CRITICAL: 0,
    };
    const typeCounts = {};
    for (const ev of input.events) {
        severityCounts[ev.severity] = (severityCounts[ev.severity] ?? 0) + 1;
        typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1;
    }
    const penalties = [];
    let score = 100;
    score -= severityCounts.CRITICAL * 25;
    score -= severityCounts.WARNING * 12;
    score -= severityCounts.INFO * 5;
    // Penalidade extra por excesso de velocidade (por ocorrência)
    // Extra penalty for speeding events (on top of base severity penalty)
    const speedingCriticalCount = input.events.filter((e) => e.type === enums_1.EventType.SPEEDING && e.severity === enums_1.EventSeverity.CRITICAL).length;
    const speedingWarningCount = input.events.filter((e) => e.type === enums_1.EventType.SPEEDING && e.severity === enums_1.EventSeverity.WARNING).length;
    score -= speedingCriticalCount * 15;
    score -= speedingWarningCount * 8;
    const profile = input.profile;
    if (profile) {
        const maxSpeed = input.trip.maxSpeedKmh ?? 0;
        if (maxSpeed > 0 && profile.maxSpeedKmh > 0) {
            if (maxSpeed > profile.maxSpeedKmh * 1.05)
                penalties.push({ reason: "Velocidade acima do limite do perfil", points: 20 });
            else if (maxSpeed > profile.maxSpeedKmh * 0.9)
                penalties.push({ reason: "Velocidade muito alta para o perfil", points: 10 });
        }
        const maxRoll = Math.abs(input.trip.maxRollDeg ?? 0);
        if (maxRoll > 0 && profile.typicalMaxRollDeg > 0) {
            if (maxRoll > profile.crashRollThreshold * 0.9)
                penalties.push({ reason: "Inclinação próxima de queda", points: 20 });
            else if (maxRoll > profile.typicalMaxRollDeg * 1.15)
                penalties.push({ reason: "Inclinação acima do típico", points: 10 });
        }
        const maxG = input.trip.maxGForce ?? 0;
        if (maxG > 0) {
            if (maxG >= profile.crashGForce)
                penalties.push({ reason: "Picos de G-force elevados", points: 12 });
            else if (maxG >= profile.crashGForce * 0.7)
                penalties.push({ reason: "G-force acima do normal", points: 6 });
        }
    }
    for (const p of penalties)
        score -= p.points;
    // Queda detectada → score vai sempre a 0, independentemente do resto
    if ((typeCounts[enums_1.EventType.CRASH_DETECTED] ?? 0) > 0) {
        score = 0;
    }
    else {
        score = clamp(Math.round(score), 0, 100);
    }
    return {
        score,
        model: "heuristic-v1",
        severityCounts,
        typeCounts,
        penalties,
    };
}
//# sourceMappingURL=trip-evaluation.service.js.map