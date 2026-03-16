// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================

import { Response } from "express";
import { prisma } from "../services/prisma.service";
import type { AuthRequest } from "../middleware/auth.middleware";

const VALID_TRIP_SOURCES = ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] as const;
type TripSourceFilter = (typeof VALID_TRIP_SOURCES)[number];

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
        motorcycle: { select: { id: true, name: true, brand: true } },
        _count: { select: { events: true } },
      },
    });

    res.json(trips);
  } catch (err) {
    console.error("[listTrips] Erro interno:", err);
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
