"use strict";
// =============================================================================
// MotoGuard IoT — Trip Categorization Service
// =============================================================================
// Classifica viagens concluídas em quatro categorias:
//   COMMUTE, WEEKEND_RIDE, TRACK_DAY, OFF_ROAD
//
// A classificação é determinística (heurística baseada em limiares) e
// complementar ao scoring existente em trip-evaluation.service.ts.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeTrip = categorizeTrip;
exports.categorizeTripById = categorizeTripById;
const prisma_service_1 = require("./prisma.service");
const enums_1 = require("../generated/prisma/enums");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getEventCount(eventCounts, key) {
    return eventCounts[key] ?? 0;
}
// ---------------------------------------------------------------------------
// Pure classification function
// ---------------------------------------------------------------------------
/**
 * Classifica uma viagem com base nas suas métricas e eventos.
 *
 * Quando o perfil está disponível, normaliza maxSpeedKmh e maxRollDeg
 * em relação aos valores do perfil antes de aplicar os limiares.
 *
 * Prioridade: TRACK_DAY > OFF_ROAD > WEEKEND_RIDE > COMMUTE
 */
function categorizeTrip(input) {
    const { trip, profile, eventCounts } = input;
    // Dados insuficientes: ambos distanceKm e avgSpeedKmh são nulos
    if (trip.distanceKm === null && trip.avgSpeedKmh === null) {
        return {
            category: "COMMUTE",
            confidence: 0.0,
            matchedRules: ["insufficient_data"],
        };
    }
    // Normalização por perfil
    let effectiveMaxSpeedKmh = trip.maxSpeedKmh;
    let effectiveMaxRollDeg = trip.maxRollDeg;
    if (profile && profile.maxSpeedKmh > 0 && profile.typicalMaxRollDeg > 0) {
        if (trip.maxSpeedKmh !== null) {
            effectiveMaxSpeedKmh = (trip.maxSpeedKmh / profile.maxSpeedKmh) * 120;
        }
        if (trip.maxRollDeg !== null) {
            effectiveMaxRollDeg = (trip.maxRollDeg / profile.typicalMaxRollDeg) * 40;
        }
    }
    // Contagens de eventos relevantes
    const speedingCount = getEventCount(eventCounts, "SPEEDING");
    const excessiveLeanCount = getEventCount(eventCounts, "EXCESSIVE_LEAN");
    const highVibrationCount = getEventCount(eventCounts, "HIGH_VIBRATION");
    const aggressiveEventCount = speedingCount + excessiveLeanCount;
    // -------------------------------------------------------------------------
    // Avaliação de cada categoria (todas as condições AND)
    // -------------------------------------------------------------------------
    // TRACK_DAY: maxSpeedKmh > 120 AND maxRollDeg > 40 AND (SPEEDING + EXCESSIVE_LEAN) > 2
    const trackDayConditions = [
        effectiveMaxSpeedKmh !== null && effectiveMaxSpeedKmh > 120,
        effectiveMaxRollDeg !== null && effectiveMaxRollDeg > 40,
        aggressiveEventCount > 2,
    ];
    const trackDayMatched = trackDayConditions.filter(Boolean).length;
    const trackDaySatisfied = trackDayMatched === trackDayConditions.length;
    // OFF_ROAD: avgSpeedKmh < 40 AND maxRollDeg > 30 AND HIGH_VIBRATION > 0
    const offRoadConditions = [
        trip.avgSpeedKmh !== null && trip.avgSpeedKmh < 40,
        effectiveMaxRollDeg !== null && effectiveMaxRollDeg > 30,
        highVibrationCount > 0,
    ];
    const offRoadMatched = offRoadConditions.filter(Boolean).length;
    const offRoadSatisfied = offRoadMatched === offRoadConditions.length;
    // WEEKEND_RIDE: distanceKm >= 30 AND avgSpeedKmh between 50–100 AND maxRollDeg < 40
    const weekendRideConditions = [
        trip.distanceKm !== null && trip.distanceKm >= 30,
        trip.avgSpeedKmh !== null && trip.avgSpeedKmh >= 50 && trip.avgSpeedKmh <= 100,
        effectiveMaxRollDeg !== null && effectiveMaxRollDeg < 40,
    ];
    const weekendRideMatched = weekendRideConditions.filter(Boolean).length;
    const weekendRideSatisfied = weekendRideMatched === weekendRideConditions.length;
    // COMMUTE: distanceKm < 30 AND avgSpeedKmh < 50 AND SPEEDING = 0
    const commuteConditions = [
        trip.distanceKm !== null && trip.distanceKm < 30,
        trip.avgSpeedKmh !== null && trip.avgSpeedKmh < 50,
        speedingCount === 0,
    ];
    const commuteMatched = commuteConditions.filter(Boolean).length;
    const commuteSatisfied = commuteMatched === commuteConditions.length;
    // -------------------------------------------------------------------------
    // Aplicar prioridade: TRACK_DAY > OFF_ROAD > WEEKEND_RIDE > COMMUTE
    // -------------------------------------------------------------------------
    if (trackDaySatisfied) {
        const matchedRules = [];
        if (trackDayConditions[0])
            matchedRules.push("maxSpeedKmh>120");
        if (trackDayConditions[1])
            matchedRules.push("maxRollDeg>40");
        if (trackDayConditions[2])
            matchedRules.push("aggressiveEvents>2");
        return {
            category: "TRACK_DAY",
            confidence: trackDayMatched / trackDayConditions.length,
            matchedRules,
        };
    }
    if (offRoadSatisfied) {
        const matchedRules = [];
        if (offRoadConditions[0])
            matchedRules.push("avgSpeedKmh<40");
        if (offRoadConditions[1])
            matchedRules.push("maxRollDeg>30");
        if (offRoadConditions[2])
            matchedRules.push("highVibration>0");
        return {
            category: "OFF_ROAD",
            confidence: offRoadMatched / offRoadConditions.length,
            matchedRules,
        };
    }
    if (weekendRideSatisfied) {
        const matchedRules = [];
        if (weekendRideConditions[0])
            matchedRules.push("distanceKm>=30");
        if (weekendRideConditions[1])
            matchedRules.push("avgSpeedKmh_50_100");
        if (weekendRideConditions[2])
            matchedRules.push("maxRollDeg<40");
        return {
            category: "WEEKEND_RIDE",
            confidence: weekendRideMatched / weekendRideConditions.length,
            matchedRules,
        };
    }
    if (commuteSatisfied) {
        const matchedRules = [];
        if (commuteConditions[0])
            matchedRules.push("distanceKm<30");
        if (commuteConditions[1])
            matchedRules.push("avgSpeedKmh<50");
        if (commuteConditions[2])
            matchedRules.push("speeding=0");
        return {
            category: "COMMUTE",
            confidence: commuteMatched / commuteConditions.length,
            matchedRules,
        };
    }
    // Fallback: nenhum critério satisfeito → COMMUTE com confiança baixa
    return {
        category: "COMMUTE",
        confidence: 0.3,
        matchedRules: ["fallback"],
    };
}
// ---------------------------------------------------------------------------
// Database-backed functions
// ---------------------------------------------------------------------------
/**
 * Lê a viagem do Prisma, classifica-a e persiste category + categoryConfidence.
 *
 * Retorna null se:
 * - A viagem não existir ou não pertencer ao userId
 * - O status não for COMPLETED
 * - distanceKm e avgSpeedKmh forem ambos nulos (dados insuficientes)
 */
async function categorizeTripById(tripId, userId) {
    const trip = await prisma_service_1.prisma.trip.findFirst({
        where: { id: tripId, userId },
        include: {
            events: true,
            motorcycle: { include: { profile: true } },
        },
    });
    if (!trip)
        return null;
    if (trip.status !== enums_1.TripStatus.COMPLETED)
        return null;
    // Dados insuficientes
    if (trip.distanceKm === null && trip.avgSpeedKmh === null) {
        console.warn(`[trip-categorization] Viagem ${tripId} sem dados suficientes (distanceKm e avgSpeedKmh nulos) — ignorada`);
        return null;
    }
    // Construir contagem de eventos por tipo
    const eventCounts = {};
    for (const event of trip.events) {
        eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
    }
    const input = {
        trip: {
            distanceKm: trip.distanceKm,
            avgSpeedKmh: trip.avgSpeedKmh,
            maxSpeedKmh: trip.maxSpeedKmh,
            maxRollDeg: trip.maxRollDeg,
            maxGForce: trip.maxGForce,
        },
        profile: trip.motorcycle.profile
            ? {
                maxSpeedKmh: trip.motorcycle.profile.maxSpeedKmh,
                typicalMaxRollDeg: trip.motorcycle.profile.typicalMaxRollDeg,
            }
            : null,
        eventCounts,
    };
    const result = categorizeTrip(input);
    await prisma_service_1.prisma.trip.update({
        where: { id: tripId },
        data: {
            category: result.category,
            categoryConfidence: result.confidence,
        },
    });
    return result;
}
//# sourceMappingURL=trip-categorization.service.js.map