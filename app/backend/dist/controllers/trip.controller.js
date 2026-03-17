"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrips = listTrips;
exports.getTrip = getTrip;
const prisma_service_1 = require("../services/prisma.service");
const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"];
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
                motorcycle: { select: { id: true, name: true, brand: true } },
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
//# sourceMappingURL=trip.controller.js.map