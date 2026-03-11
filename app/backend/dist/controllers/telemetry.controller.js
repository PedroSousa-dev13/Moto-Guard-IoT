"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Telemetry
// =============================================================================
// Endpoints relacionados com telemetria:
//   · GET /api/telemetry/latest      — Última leitura em memória (MQTT)
//   · GET /api/telemetry/:tripId     — Dados de telemetria de uma viagem (InfluxDB)
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestTelemetry = getLatestTelemetry;
exports.getTripTelemetry = getTripTelemetry;
const telemetry_store_1 = require("../services/telemetry.store");
const prisma_service_1 = require("../services/prisma.service");
const influx_service_1 = require("../services/influx.service");
function getLatestTelemetry(_req, res) {
    if (!telemetry_store_1.telemetryStore.latest) {
        res.status(204).json({ message: "Sem dados de telemetria ainda" });
        return;
    }
    res.json({
        received_at: new Date().toISOString(),
        total_messages: telemetry_store_1.telemetryStore.count,
        data: telemetry_store_1.telemetryStore.latest,
    });
}
// ─── Telemetria de uma viagem (InfluxDB) ────────────────────────────────────
// NOTA: Ficará completo após a etapa 1.6 (configuração do InfluxDB).
//       Por agora, valida a viagem no PostgreSQL e retorna 501.
async function getTripTelemetry(req, res) {
    const userId = req.userId;
    const tripId = req.params.tripId;
    // Verificar que a viagem pertence ao utilizador
    const trip = await prisma_service_1.prisma.trip.findFirst({
        where: { id: tripId, userId },
        select: { id: true, startedAt: true, endedAt: true, status: true },
    });
    if (!trip) {
        res.status(404).json({ error: "Viagem não encontrada" });
        return;
    }
    // Obter deviceId da mota associada à viagem (para filtrar no InfluxDB)
    const motorcycle = await prisma_service_1.prisma.motorcycle.findFirst({
        where: { trips: { some: { id: tripId } } },
        select: { deviceId: true },
    });
    try {
        const points = await influx_service_1.influxService.queryTripTelemetry(trip.startedAt, trip.endedAt, motorcycle?.deviceId);
        res.json({
            trip,
            total_points: points.length,
            data: points,
        });
    }
    catch (err) {
        console.error("❌ Erro ao consultar InfluxDB:", err.message);
        res.status(503).json({ error: "Não foi possível consultar o InfluxDB" });
    }
}
//# sourceMappingURL=telemetry.controller.js.map