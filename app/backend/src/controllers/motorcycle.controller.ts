// =============================================================================
// MotoGuard IoT — Controller: Motorcycles (Motas)
// =============================================================================
// POST /api/motorcycles          — Associar mota ao utilizador
// GET  /api/motorcycles          — Listar motas do utilizador
// GET  /api/motorcycle-profiles  — Listar perfis/classes disponíveis
// =============================================================================

import { Response } from "express";
import { prisma } from "../services/prisma.service";
import type { AuthRequest } from "../middleware/auth.middleware";

// ─── Criar mota ─────────────────────────────────────────────────────────────
export async function createMotorcycle(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { name, brand, year, profileId, deviceId } = req.body;

  if (!name) {
    res.status(400).json({ error: "Campo 'name' é obrigatório" });
    return;
  }

  // Validar que o perfil existe (se fornecido)
  if (profileId) {
    const profile = await prisma.motorcycleProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      res.status(400).json({ error: "Perfil de mota não encontrado" });
      return;
    }
  }

  const motorcycle = await prisma.motorcycle.create({
    data: {
      userId,
      name,
      brand: brand || null,
      year: year ? parseInt(year, 10) : null,
      profileId: profileId || null,
      deviceId: deviceId || null,
    },
    include: { profile: true },
  });

  res.status(201).json(motorcycle);
}

// ─── Listar motas do utilizador ─────────────────────────────────────────────
export async function listMotorcycles(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;

  const motorcycles = await prisma.motorcycle.findMany({
    where: { userId },
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(motorcycles);
}

// ─── Listar perfis de mota disponíveis ──────────────────────────────────────
export async function listProfiles(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  const profiles = await prisma.motorcycleProfile.findMany({
    orderBy: { name: "asc" },
  });

  res.json(profiles);
}
