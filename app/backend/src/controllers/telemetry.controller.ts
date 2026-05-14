// =============================================================================
// MotoGuard IoT — Controller: Telemetry
// =============================================================================
// Endpoints relacionados com telemetria:
//   · GET /api/telemetry/latest      — Última leitura em memória (MQTT)
//   · GET /api/telemetry/:tripId     — Dados de telemetria de uma viagem (InfluxDB)
// =============================================================================

import { Request, Response } from "express";
import { telemetryStore } from "../services/telemetry.store";
import { prisma } from "../services/prisma.service";
import { influxService } from "../services/influx.service";
import type { AuthRequest } from "../middleware/auth.middleware";

export function getLatestTelemetry(_req: Request, res: Response): void {
  if (!telemetryStore.latest) {
    res.status(204).json({ message: "Sem dados de telemetria ainda" });
    return;
  }

  res.json({
    received_at: new Date().toISOString(),
    total_messages: telemetryStore.count,
    data: telemetryStore.latest,
  });
}

// ─── Telemetria de uma viagem (InfluxDB) ────────────────────────────────────
// NOTA: Ficará completo após a etapa 1.6 (configuração do InfluxDB).
//       Por agora, valida a viagem no PostgreSQL e retorna 501.
export async function getTripTelemetry(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const tripId = req.params.tripId as string;
  const t0 = Date.now();

  // Verificar que a viagem pertence ao utilizador
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    select: { id: true, startedAt: true, endedAt: true, status: true, source: true },
  });

  if (!trip) {
    res.status(404).json({ error: "Viagem não encontrada" });
    return;
  }

  // NOTA: GPX_IMPORTED trips agora também têm telemetria no InfluxDB
  // (emitida pelo GPX Simulator via Socket.IO), portanto não fazemos early-return.

  // Obter deviceId da mota associada à viagem (para filtrar no InfluxDB)
  const motorcycle = await prisma.motorcycle.findFirst({
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
    const points = await influxService.queryTripTelemetry(
      trip.startedAt,
      trip.endedAt,
      motorcycle?.deviceId
    );
    const influxMs = Date.now() - t1;
    const totalMs = Date.now() - t0;

    console.log(`[TELEMETRY] ${tripId} — ${points.length} pontos, InfluxDB: ${influxMs}ms, total: ${totalMs}ms`);
    if (influxMs > 2000) {
      console.warn(`[TELEMETRY SLOW] InfluxDB demorou ${influxMs}ms para ${tripId} — considera reduzir o range ou adicionar downsampling`);
    }

    res.json({ trip, total_points: points.length, data: points });
  } catch (err) {
    console.warn(`[TELEMETRY] InfluxDB indisponível para ${tripId} (${Date.now() - t0}ms):`, (err as Error).message);
    res.status(503).json({ error: "Base de dados de telemetria temporariamente indisponível", trip, total_points: 0, data: [] });
  }
}
