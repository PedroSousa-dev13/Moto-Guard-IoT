// =============================================================================
// MotoGuard IoT — Controller: Trips (Viagens)
// =============================================================================
// GET /api/trips      — Listar viagens do utilizador autenticado
// GET /api/trips/:id  — Detalhe de uma viagem (com eventos)
// =============================================================================

import { Response } from "express";
import { prisma } from "../services/prisma.service";
import type { AuthRequest } from "../middleware/auth.middleware";

// ─── Listar viagens ─────────────────────────────────────────────────────────
export async function listTrips(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const trips = await prisma.trip.findMany({
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
export async function getTrip(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;

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
}
