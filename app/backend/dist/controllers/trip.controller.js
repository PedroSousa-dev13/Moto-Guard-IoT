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
// ─── Listar viagens ─────────────────────────────────────────────────────────
async function listTrips(req, res) {
    const userId = req.userId;
    const trips = await prisma_service_1.prisma.trip.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        include: {
            motorcycle: { select: { id: true, name: true, brand: true } },
            _count: { select: { events: true } },
        },
    });
    res.json(trips);
}
// ─── Detalhe de viagem ──────────────────────────────────────────────────────
async function getTrip(req, res) {
    const userId = req.userId;
    const id = req.params.id;
    const trip = await prisma_service_1.prisma.trip.findFirst({
        where: { id, userId },
        include: {
            motorcycle: {
                select: { id: true, name: true, brand: true, profile: true },
            },
            events: { orderBy: { occurredAt: "asc" } },
        },
    });
    if (!trip) {
        res.status(404).json({ error: "Viagem não encontrada" });
        return;
    }
    res.json(trip);
}
//# sourceMappingURL=trip.controller.js.map