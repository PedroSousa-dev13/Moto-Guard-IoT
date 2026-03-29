"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTripFeedItem = buildTripFeedItem;
const enums_1 = require("../generated/prisma/enums");
const trip_evaluation_service_1 = require("./trip-evaluation.service");
function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
}
function scoreColorBucket(score) {
    if (score >= 80)
        return "good";
    if (score >= 60)
        return "warn";
    return "bad";
}
function countBySeverity(events) {
    return {
        INFO: events.filter((e) => e.severity === enums_1.EventSeverity.INFO).length,
        WARNING: events.filter((e) => e.severity === enums_1.EventSeverity.WARNING).length,
        CRITICAL: events.filter((e) => e.severity === enums_1.EventSeverity.CRITICAL).length,
    };
}
function countByType(events) {
    const out = {};
    for (const ev of events) {
        out[ev.type] = (out[ev.type] ?? 0) + 1;
    }
    return out;
}
function computePerformanceScore(input) {
    const counts = input.typeCounts;
    let score = 100;
    score -= (counts.HARD_BRAKING ?? 0) * 6;
    score -= (counts.RAPID_ACCELERATION ?? 0) * 5;
    score -= (counts.HIGH_VIBRATION ?? 0) * 6;
    score -= (counts.OVERHEAT ?? 0) * 12;
    score -= (counts.LOW_VOLTAGE ?? 0) * 10;
    score -= (counts.TIRE_PRESSURE_LOW ?? 0) * 10;
    score -= (counts.OIL_PRESSURE_LOW ?? 0) * 12;
    score = clamp(score, 0, 100);
    const profileMax = input.trip.profile?.maxSpeedKmh ?? 0;
    const avg = input.trip.avgSpeedKmh ?? 0;
    if (profileMax > 0 && avg > 0) {
        const pace = clamp((avg / profileMax) * 100, 0, 100);
        score = clamp(Math.round(score * 0.75 + pace * 0.25), 0, 100);
    }
    return score;
}
function computeLabels(input) {
    const labels = [];
    const started = new Date(input.trip.startedAt);
    const day = started.getDay();
    if (day === 0 || day === 6)
        labels.push("Weekend Tour");
    const distance = input.trip.distanceKm ?? 0;
    if (distance >= 120)
        labels.push("Long Ride");
    else if (distance >= 60)
        labels.push("Tour");
    else if (distance > 0 && distance <= 20)
        labels.push("Short Ride");
    const hour = started.getHours();
    if (hour >= 20 || hour <= 5)
        labels.push("Night Ride");
    const maxSpeed = input.trip.maxSpeedKmh ?? 0;
    const maxRoll = Math.abs(input.trip.maxRollDeg ?? 0);
    const hasLean = (input.typeCounts.EXCESSIVE_LEAN ?? 0) > 0;
    if (maxSpeed >= 170 && maxRoll >= 35 && hasLean && input.performanceScore >= 70)
        labels.push("Track Day");
    if (input.trip.source === "GPX_IMPORTED")
        labels.push("Imported Route");
    if (input.severityCounts.CRITICAL > 0)
        labels.push("Critical Alerts");
    else if (input.severityCounts.WARNING >= 3)
        labels.push("Many Alerts");
    if (input.safetyScore >= 90 && input.performanceScore >= 80)
        labels.push("Smooth Ride");
    if (input.safetyScore <= 60)
        labels.push("Risky Ride");
    return Array.from(new Set(labels)).slice(0, 3);
}
function buildTripFeedItem(trip, events) {
    const bySeverityAll = countBySeverity(events);
    const byTypeAll = countByType(events);
    const impactEvents = events.filter((e) => e.severity !== enums_1.EventSeverity.INFO);
    const evaluation = (0, trip_evaluation_service_1.evaluateTripHeuristic)({
        trip: {
            maxSpeedKmh: trip.maxSpeedKmh,
            maxRollDeg: trip.maxRollDeg,
            maxGForce: trip.maxGForce,
        },
        profile: trip.profile ?? null,
        events: impactEvents,
    });
    const performanceScore = computePerformanceScore({ trip, typeCounts: evaluation.typeCounts });
    const labels = computeLabels({
        trip,
        safetyScore: evaluation.score,
        performanceScore,
        severityCounts: evaluation.severityCounts,
        typeCounts: evaluation.typeCounts,
    });
    return {
        id: trip.id,
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        status: trip.status,
        source: trip.source,
        distanceKm: trip.distanceKm,
        avgSpeedKmh: trip.avgSpeedKmh,
        maxSpeedKmh: trip.maxSpeedKmh,
        category: trip.category ?? null,
        categoryConfidence: trip.categoryConfidence ?? null,
        motorcycle: trip.motorcycle,
        eventCounts: {
            total: events.length,
            bySeverity: bySeverityAll,
            byType: byTypeAll,
        },
        safetyScore: evaluation.score,
        performanceScore,
        labels,
        buckets: {
            safety: scoreColorBucket(evaluation.score),
            performance: scoreColorBucket(performanceScore),
        },
    };
}
//# sourceMappingURL=trip-feed.service.js.map