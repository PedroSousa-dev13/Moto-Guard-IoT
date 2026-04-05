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
    const t0 = Date.now();
    // Verificar que a viagem pertence ao utilizador
    const trip = await prisma_service_1.prisma.trip.findFirst({
        where: { id: tripId, userId },
        select: { id: true, startedAt: true, endedAt: true, status: true, source: true },
    });
    if (!trip) {
        res.status(404).json({ error: "Viagem não encontrada" });
        return;
    }
    if (trip.source === "GPX_IMPORTED") {
        console.log(`[TELEMETRY] ${tripId} — GPX_IMPORTED, sem dados InfluxDB (${Date.now() - t0}ms)`);
        res.json({ trip, total_points: 0, data: [] });
        return;
    }
    // Obter deviceId da mota associada à viagem (para filtrar no InfluxDB)
    const motorcycle = await prisma_service_1.prisma.motorcycle.findFirst({
        where: { trips: { some: { id: tripId } } },
        select: { deviceId: true },
    });
    if (!motorcycle?.deviceId) {
        console.warn(`[TELEMETRY] ${tripId} — sem deviceId associado (${Date.now() - t0}ms)`);
        res.json({ trip, total_points: 0, data: [] });
        return;
    }
    try {
        const t1 = Date.now();
        const points = await influx_service_1.influxService.queryTripTelemetry(trip.startedAt, trip.endedAt, motorcycle?.deviceId);
        const influxMs = Date.now() - t1;
        const totalMs = Date.now() - t0;
        console.log(`[TELEMETRY] ${tripId} — ${points.length} pontos, InfluxDB: ${influxMs}ms, total: ${totalMs}ms`);
        if (influxMs > 2000) {
            console.warn(`[TELEMETRY SLOW] InfluxDB demorou ${influxMs}ms para ${tripId} — considera reduzir o range ou adicionar downsampling`);
        }
        res.json({ trip, total_points: points.length, data: points });
    }
    catch (err) {
        console.warn(`[TELEMETRY] InfluxDB indisponível para ${tripId} (${Date.now() - t0}ms):`, err.message);
        res.json({ trip, total_points: 0, data: [] });
    }
}
//# sourceMappingURL=telemetry.controller.js.map