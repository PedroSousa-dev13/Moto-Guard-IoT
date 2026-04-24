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

const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] as const;
type TripSourceFilter = (typeof VALID_TRIP_SOURCES)[number];
const VALID_TRIP_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
type TripStatusFilter = (typeof VALID_TRIP_STATUSES)[number];

function clampInt(value: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

// ─── Listar viagens ─────────────────────────────────────────────────────────
export async function listTrips(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;
  const status = req.query.status as string | undefined;

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
    const trips = await prisma.trip.findMany({
      where: {
        userId,
        ...(source ? { source: source as TripSourceFilter } : {}),
        ...(status ? { status: status as TripStatusFilter } : {}),
      },
      orderBy: { startedAt: "desc" },
      include: {
        motorcycle: { select: { id: true, name: true, brand: true, category: true, profile: true } },
        events: { select: { type: true, severity: true } },
        _count: { select: { events: true } },
      },
    });

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

    res.json(items);
  } catch (err) {
    console.error("[listTrips] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function listTripFeed(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;
  const status = req.query.status as string | undefined;

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

  const limit = clampInt(req.query.limit, 50, 1, 200);

  try {
    const trips = await prisma.trip.findMany({
      where: {
        userId,
        ...(status ? { status: status as TripStatusFilter } : {}),
        ...(source ? { source: source as TripSourceFilter } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        motorcycle: { select: { id: true, name: true, brand: true, category: true, profile: true } },
        events: { select: { type: true, severity: true } },
      },
    });

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

    res.json(items);
  } catch (err) {
    console.error("[listTripFeed] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Detalhe de viagem ──────────────────────────────────────────────────────
export async function getTrip(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;

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

  try {
    // Verificar se a viagem existe e pertence ao utilizador (Req 5.3, 5.4)
    const trip = await prisma.trip.findFirst({ where: { id } });
    if (!trip) {
      res.status(404).json({ error: "Viagem não encontrada" });
      return;
    }
    if (trip.userId !== userId) {
      res.status(403).json({ error: "Acesso negado" });
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
  const { severity, type, tripId, limit: limitRaw } = req.query as Record<string, string | undefined>;
  const limit = clampInt(limitRaw, 100, 1, 500);

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
    const events = await prisma.tripEvent.findMany({
      where: {
        trip: { userId },
        ...(severity ? { severity: severity as any } : {}),
        ...(type ? { type: type as any } : {}),
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
  } catch (err) {
    console.error("[listAlerts] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}
