// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================

import { Response } from "express";
import { prisma } from "../services/prisma.service";
import type { AuthRequest } from "../middleware/auth.middleware";
import { runTripMlPipeline, getMlStatus } from "../services/trip-ml-pipeline.service";
import { buildTripFeedItem } from "../services/trip-feed.service";
import { categorizeTripById } from "../services/trip-categorization.service";
import type { EventSeverity, EventType } from "../generated/prisma/enums";

const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] as const;
type TripSourceFilter = (typeof VALID_TRIP_SOURCES)[number];
const VALID_TRIP_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
type TripStatusFilter = (typeof VALID_TRIP_STATUSES)[number];

function clampInt(value: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ─── Listar viagens (com paginação) ─────────────────────────────────────────
export async function listTrips(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;
  const status = req.query.status as string | undefined;
  const page = clampInt(req.query.page, 1, 1, 1000);
  const limit = clampInt(req.query.limit, 50, 1, 200);
  const skip = (page - 1) * limit;

  if (source && !VALID_TRIP_SOURCES.includes(source as TripSourceFilter)) {
    res.status(400).json({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    return;
  }

  if (status && !VALID_TRIP_STATUSES.includes(status as TripStatusFilter)) {
    res.status(400).json({
      error: "Parâmetro status inválido. Use: ACTIVE | COMPLETED | CANCELLED",
    });
    return;
  }

  try {
    const where = {
      userId,
      ...(source ? { source: source as TripSourceFilter } : {}),
      ...(status ? { status: status as TripStatusFilter } : {}),
    };

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          motorcycle: { select: { id: true, name: true, brand: true, category: true, profile: true } },
          events: { select: { type: true, severity: true } },
          _count: { select: { events: true } },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    const items = trips.map((t) => {
      const feedItem = buildTripFeedItem(
        {
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
          drivingStyle: t.drivingStyle,
          motorcycle: t.motorcycle
            ? { id: t.motorcycle.id, name: t.motorcycle.name, brand: t.motorcycle.brand, category: t.motorcycle.category }
            : null,
          profile: t.motorcycle?.profile ?? null,
        },
        t.events,
      );

      return {
        ...t,
        safetyScore: feedItem.safetyScore,
        performanceScore: feedItem.performanceScore,
      };
    });

    res.json({ data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[listTrips] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function listTripFeed(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;
  const status = req.query.status as string | undefined;
  const page = clampInt(req.query.page, 1, 1, 1000);
  const limit = clampInt(req.query.limit, 50, 1, 200);
  const skip = (page - 1) * limit;

  if (source && !VALID_TRIP_SOURCES.includes(source as TripSourceFilter)) {
    res.status(400).json({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    return;
  }

  if (status && !VALID_TRIP_STATUSES.includes(status as TripStatusFilter)) {
    res.status(400).json({
      error: "Parâmetro status inválido. Use: ACTIVE | COMPLETED | CANCELLED",
    });
    return;
  }

  try {
    const where = {
      userId,
      ...(status ? { status: status as TripStatusFilter } : {}),
      ...(source ? { source: source as TripSourceFilter } : {}),
    };

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          motorcycle: { select: { id: true, name: true, brand: true, category: true, profile: true } },
          events: { select: { type: true, severity: true } },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    const items = trips.map((t) =>
      buildTripFeedItem(
        {
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
          drivingStyle: t.drivingStyle,
          motorcycle: t.motorcycle ? { id: t.motorcycle.id, name: t.motorcycle.name, brand: t.motorcycle.brand, category: t.motorcycle.category } : null,
          profile: t.motorcycle?.profile ?? null,
        },
        t.events,
      ),
    );

    res.json({ data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[listTripFeed] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Detalhe de viagem ──────────────────────────────────────────────────────
export async function getTrip(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;

  if (!isValidUuid(id)) {
    res.status(400).json({ error: "ID de viagem inválido" });
    return;
  }

  try {
    const trip = await prisma.trip.findFirst({
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
  } catch (err) {
    console.error("[getTrip] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function getTripEvaluation(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;

  if (!isValidUuid(id)) {
    res.status(400).json({ error: "ID de viagem inválido" });
    return;
  }

  try {
    const trip = await prisma.trip.findFirst({ where: { id, userId } });
    if (!trip) {
      res.status(404).json({ error: "Viagem não encontrada" });
      return;
    }

    const evaluation = await runTripMlPipeline(id, userId);
    if (!evaluation) {
      res.status(404).json({ error: "Viagem não encontrada" });
      return;
    }
    res.json(evaluation);
  } catch (err) {
    console.error("[getTripEvaluation] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function getMlStatusHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const status = await getMlStatus();
    res.json(status);
  } catch (err) {
    console.error("[getMlStatus] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

// ─── Recategorizar viagem ────────────────────────────────────────────────────
export async function categorizeTripHandler(req: AuthRequest, res: Response): Promise<void> {
  const tripId = req.params.id as string;
  const userId = req.userId!;

  if (!isValidUuid(tripId)) {
    res.status(400).json({ error: "ID de viagem inválido" });
    return;
  }

  try {
    const result = await categorizeTripById(tripId, userId);

    if (result === null) {
      res.status(404).json({ error: "Viagem não encontrada, não pertence ao utilizador ou não está concluída" });
      return;
    }

    res.status(200).json({
      category: result.category,
      confidence: result.confidence,
      matchedRules: result.matchedRules,
    });
  } catch (err) {
    console.error("[categorizeTripHandler] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Listar alertas (TripEvents) do utilizador ──────────────────────────────
// GET /api/alerts?severity=CRITICAL&type=CRASH_DETECTED&limit=50&tripId=xxx
export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { severity, type, tripId } = req.query as Record<string, string | undefined>;
  const page = clampInt(req.query.page, 1, 1, 1000);
  const limit = clampInt(req.query.limit, 100, 1, 500);
  const skip = (page - 1) * limit;

  const VALID_SEVERITIES = ["INFO", "WARNING", "CRITICAL"];
  const VALID_TYPES = [
    "HARD_BRAKING", "EXCESSIVE_LEAN", "HIGH_VIBRATION", "OVERHEAT",
    "LOW_VOLTAGE", "CRASH_DETECTED", "RAPID_ACCELERATION",
    "TIRE_PRESSURE_LOW", "OIL_PRESSURE_LOW", "SPEEDING",
    "WHEELIE_DETECTED", "STOPPIE_DETECTED", "ENGINE_OVERREV", "SAFETY_SYSTEM_ACTIVE",
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
    const where = {
      trip: { userId },
      ...(severity ? { severity: severity as EventSeverity } : {}),
      ...(type ? { type: type as EventType } : {}),
      ...(tripId ? { tripId } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.tripEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip,
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
      }),
      prisma.tripEvent.count({ where }),
    ]);

    res.json({ data: events, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[listAlerts] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

// ─── Clustering Stats — distribuição de estilos de condução ──────────────────
export async function getClusteringStats(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  try {
    const [drivingStyleDist, totalClustered] = await Promise.all([
      prisma.trip.groupBy({
        by: ["drivingStyle"],
        where: { userId, status: "COMPLETED", drivingStyle: { not: null } },
        _count: { drivingStyle: true },
      }),
      prisma.trip.count({
        where: { userId, status: "COMPLETED", drivingStyle: { not: null } },
      }),
    ]);

    const distribution: Record<string, number> = {};
    for (const row of drivingStyleDist) {
      if (row.drivingStyle) distribution[row.drivingStyle] = row._count.drivingStyle;
    }

    res.json({
      totalClustered,
      distribution,
      hasEnoughData: totalClustered >= 3,
    });
  } catch (err) {
    console.error("[getClusteringStats] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

// ─── Trip Statistics / Analytics — métricas agregadas do utilizador ──────────
export async function getTripStats(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  try {
    const [tripAgg, eventAgg, sourceDist, categoryDist, statusDist] = await Promise.all([
      prisma.trip.aggregate({
        where: { userId, status: "COMPLETED" },
        _count: { id: true },
        _sum: { distanceKm: true },
        _avg: { maxSpeedKmh: true, avgSpeedKmh: true, distanceKm: true, maxRollDeg: true, maxGForce: true },
      }),
      prisma.tripEvent.groupBy({
        by: ["severity"],
        where: { trip: { userId } },
        _count: { severity: true },
      }),
      prisma.trip.groupBy({
        by: ["source"],
        where: { userId },
        _count: { source: true },
      }),
      prisma.trip.groupBy({
        by: ["category"],
        where: { userId, category: { not: null } },
        _count: { category: true },
      }),
      prisma.trip.groupBy({
        by: ["status"],
        where: { userId },
        _count: { status: true },
      }),
    ]);

    const eventsBySeverity: Record<string, number> = {};
    for (const row of eventAgg) {
      eventsBySeverity[row.severity] = row._count.severity;
    }

    const tripsBySource: Record<string, number> = {};
    for (const row of sourceDist) {
      tripsBySource[row.source] = row._count.source;
    }

    const tripsByCategory: Record<string, number> = {};
    for (const row of categoryDist) {
      if (row.category) tripsByCategory[row.category] = row._count.category;
    }

    const tripsByStatus: Record<string, number> = {};
    for (const row of statusDist) {
      tripsByStatus[row.status] = row._count.status;
    }

    res.json({
      totalTrips: tripAgg._count.id,
      totalDistanceKm: tripAgg._sum.distanceKm ?? 0,
      avgMaxSpeedKmh: tripAgg._avg.maxSpeedKmh ? Math.round(tripAgg._avg.maxSpeedKmh * 10) / 10 : null,
      avgAvgSpeedKmh: tripAgg._avg.avgSpeedKmh ? Math.round(tripAgg._avg.avgSpeedKmh * 10) / 10 : null,
      avgDistanceKm: tripAgg._avg.distanceKm ? Math.round(tripAgg._avg.distanceKm * 10) / 10 : null,
      avgMaxRollDeg: tripAgg._avg.maxRollDeg ? Math.round(tripAgg._avg.maxRollDeg * 10) / 10 : null,
      avgMaxGForce: tripAgg._avg.maxGForce ? Math.round(tripAgg._avg.maxGForce * 10) / 10 : null,
      eventsBySeverity,
      tripsBySource,
      tripsByCategory,
      tripsByStatus,
    });
  } catch (err) {
    console.error("[getTripStats] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}
