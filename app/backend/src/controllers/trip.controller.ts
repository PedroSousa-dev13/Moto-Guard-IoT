// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================

import { Response } from "express";
import { prisma } from "../services/prisma.service";
import type { AuthRequest } from "../middleware/auth.middleware";
import { runTripMlPipeline } from "../services/trip-ml-pipeline.service";
import { buildTripFeedItem } from "../services/trip-feed.service";

const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] as const;
type TripSourceFilter = (typeof VALID_TRIP_SOURCES)[number];

function clampInt(value: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

// ─── Listar viagens ─────────────────────────────────────────────────────────
export async function listTrips(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;

  if (source && !VALID_TRIP_SOURCES.includes(source as TripSourceFilter)) {
    res.status(400).json({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    return;
  }

  try {
    const trips = await prisma.trip.findMany({
      where: {
        userId,
        ...(source ? { source: source as TripSourceFilter } : {}),
      },
      orderBy: { startedAt: "desc" },
      include: {
        motorcycle: { select: { id: true, name: true, brand: true, category: true } },
        _count: { select: { events: true } },
      },
    });

    res.json(trips);
  } catch (err) {
    console.error("[listTrips] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function listTripFeed(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const source = req.query.source as string | undefined;

  if (source && !VALID_TRIP_SOURCES.includes(source as TripSourceFilter)) {
    res.status(400).json({
      error: "Parâmetro source inválido. Use: SIMULATOR | GPX_IMPORTED | DEVICE_REAL",
    });
    return;
  }

  const limit = clampInt(req.query.limit, 50, 1, 200);

  try {
    const trips = await prisma.trip.findMany({
      where: {
        userId,
        status: "COMPLETED",
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
