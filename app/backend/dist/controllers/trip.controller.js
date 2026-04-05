"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrips = listTrips;
exports.listTripFeed = listTripFeed;
exports.getTrip = getTrip;
exports.getTripEvaluation = getTripEvaluation;
exports.getMlStatusHandler = getMlStatusHandler;
exports.categorizeTripHandler = categorizeTripHandler;
exports.listAlerts = listAlerts;
const prisma_service_1 = require("../services/prisma.service");
const trip_ml_pipeline_service_1 = require("../services/trip-ml-pipeline.service");
const trip_feed_service_1 = require("../services/trip-feed.service");
const trip_categorization_service_1 = require("../services/trip-categorization.service");
const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"];
function clampInt(value, fallback, lo, hi) {
    const n = typeof value === "string" ? parseInt(value, 10) : Number.NaN;
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(lo, Math.min(hi, n));
}
// ─── Listar viagens ─────────────────────────────────────────────────────────
async function listTrips(req, res) {
    const userId = req.userId;
    const source = req.query.source;
    if (source && !VALID_TRIP_SOURCES.includes(source)) {
        res.status(400).json({
            error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
        });
        return;
    }
    try {
        const trips = await prisma_service_1.prisma.trip.findMany({
            where: {
                userId,
                ...(source ? { source: source } : {}),
            },
            orderBy: { startedAt: "desc" },
            include: {
                motorcycle: { select: { id: true, name: true, brand: true, category: true } },
                _count: { select: { events: true } },
            },
        });
        res.json(trips);
    }
    catch (err) {
        console.error("[listTrips] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function listTripFeed(req, res) {
    const userId = req.userId;
    const source = req.query.source;
    if (source && !VALID_TRIP_SOURCES.includes(source)) {
        res.status(400).json({
            error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
        });
        return;
    }
    const limit = clampInt(req.query.limit, 50, 1, 200);
    try {
        const trips = await prisma_service_1.prisma.trip.findMany({
            where: {
                userId,
                status: "COMPLETED",
                ...(source ? { source: source } : {}),
            },
            orderBy: { startedAt: "desc" },
            take: limit,
            include: {
                motorcycle: { select: { id: true, name: true, brand: true, category: true, profile: true } },
                events: { select: { type: true, severity: true } },
            },
        });
        const items = trips.map((t) => (0, trip_feed_service_1.buildTripFeedItem)({
            id: t.id,
            startedAt: t.startedAt,
            endedAt: t.endedAt,
            status: t.status,
            source: t.source,
            distanceKm: t.distanceKm,
            avgSpeedKmh: t.avgSpeedKmh,
            maxSpeedKmh: t.maxSpeedKmh,
            maxRollDeg: t.maxRollDeg,
            maxGForce: t.maxGForce,
            category: t.category,
            categoryConfidence: t.categoryConfidence,
            motorcycle: t.motorcycle ? { id: t.motorcycle.id, name: t.motorcycle.name, brand: t.motorcycle.brand, category: t.motorcycle.category } : null,
            profile: t.motorcycle?.profile ?? null,
        }, t.events));
        res.json(items);
    }
    catch (err) {
        console.error("[listTripFeed] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Detalhe de viagem ──────────────────────────────────────────────────────
async function getTrip(req, res) {
    const userId = req.userId;
    const id = req.params.id;
    try {
        const trip = await prisma_service_1.prisma.trip.findFirst({
            where: { id, userId },
            include: {
                motorcycle: {
                    select: { id: true, name: true, brand: true, profile: true },
                },
                gpxData: true,
                events: { orderBy: { occurredAt: "asc" } },
            },
        });
        if (!trip) {
            res.status(404).json({ error: "Viagem não encontrada" });
            return;
        }
        res.json(trip);
    }
    catch (err) {
        console.error("[getTrip] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function getTripEvaluation(req, res) {
    const userId = req.userId;
    const id = req.params.id;
    try {
        // Verificar se a viagem existe e pertence ao utilizador (Req 5.3, 5.4)
        const trip = await prisma_service_1.prisma.trip.findFirst({ where: { id } });
        if (!trip) {
            res.status(404).json({ error: "Viagem não encontrada" });
            return;
        }
        if (trip.userId !== userId) {
            res.status(403).json({ error: "Acesso negado" });
            return;
        }
        const evaluation = await (0, trip_ml_pipeline_service_1.runTripMlPipeline)(id, userId);
        if (!evaluation) {
            res.status(404).json({ error: "Viagem não encontrada" });
            return;
        }
        res.json(evaluation);
    }
    catch (err) {
        console.error("[getTripEvaluation] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function getMlStatusHandler(req, res) {
    try {
        const status = await (0, trip_ml_pipeline_service_1.getMlStatus)();
        res.json(status);
    }
    catch (err) {
        console.error("[getMlStatus] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
// ─── Recategorizar viagem ────────────────────────────────────────────────────
async function categorizeTripHandler(req, res) {
    const tripId = req.params.id;
    const userId = req.userId;
    try {
        const result = await (0, trip_categorization_service_1.categorizeTripById)(tripId, userId);
        if (result === null) {
            res.status(404).json({ error: "Viagem não encontrada, não pertence ao utilizador ou não está concluída" });
            return;
        }
        res.status(200).json({
            category: result.category,
            confidence: result.confidence,
            matchedRules: result.matchedRules,
        });
    }
    catch (err) {
        console.error("[categorizeTripHandler] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Listar alertas (TripEvents) do utilizador ──────────────────────────────
// GET /api/alerts?severity=CRITICAL&type=CRASH_DETECTED&limit=50&tripId=xxx
async function listAlerts(req, res) {
    const userId = req.userId;
    const { severity, type, tripId, limit: limitRaw } = req.query;
    const limit = clampInt(limitRaw, 100, 1, 500);
    const VALID_SEVERITIES = ["INFO", "WARNING", "CRITICAL"];
    const VALID_TYPES = [
        "HARD_BRAKING", "EXCESSIVE_LEAN", "HIGH_VIBRATION", "OVERHEAT",
        "LOW_VOLTAGE", "CRASH_DETECTED", "RAPID_ACCELERATION",
        "TIRE_PRESSURE_LOW", "OIL_PRESSURE_LOW", "SPEEDING",
    ];
    if (severity && !VALID_SEVERITIES.includes(severity)) {
        res.status(400).json({ error: "severity inválido" });
        return;
    }
    if (type && !VALID_TYPES.includes(type)) {
        res.status(400).json({ error: "type inválido" });
        return;
    }
    try {
        const events = await prisma_service_1.prisma.tripEvent.findMany({
            where: {
                trip: { userId },
                ...(severity ? { severity: severity } : {}),
                ...(type ? { type: type } : {}),
                ...(tripId ? { tripId } : {}),
            },
            orderBy: { occurredAt: "desc" },
            take: limit,
            include: {
                trip: {
                    select: {
                        id: true,
                        source: true,
                        motorcycle: { select: { name: true, brand: true, deviceId: true } },
                    },
                },
            },
        });
        res.json(events);
    }
    catch (err) {
        console.error("[listAlerts] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
}
//# sourceMappingURL=trip.controller.js.map