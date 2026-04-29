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
  const { name, brand, model, year, plate, category, profileId, deviceId } = req.body;

  if (!name) {
    res.status(400).json({ error: "Campo 'name' é obrigatório" });
    return;
  }
  if (!category) {
    res.status(400).json({ error: "Campo 'category' é obrigatório" });
    return;
  }

  try {
    let finalProfileId = profileId;
    if (finalProfileId) {
      const profile = await prisma.motorcycleProfile.findUnique({ where: { id: finalProfileId } });
      if (!profile) {
        res.status(400).json({ error: "Perfil de mota não encontrado" });
        return;
      }
    } else if (category) {
      const profile = await prisma.motorcycleProfile.findUnique({ where: { name: category } });
      if (profile) {
        finalProfileId = profile.id;
      }
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        userId,
        name,
        brand: brand || null,
        model: model || null,
        year: year ? parseInt(year, 10) : null,
        plate: plate || null,
        category: category || null,
        profileId: finalProfileId || null,
        deviceId: deviceId || null,
      },
      include: { profile: true },
    });

    res.status(201).json(motorcycle);
  } catch (err) {
    console.error("[createMotorcycle] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Listar motas do utilizador ─────────────────────────────────────────────
export async function listMotorcycles(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;

  try {
    const motorcycles = await prisma.motorcycle.findMany({
      where: { userId },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(motorcycles);
  } catch (err) {
    console.error("[listMotorcycles] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

// ─── Listar perfis de mota disponíveis ──────────────────────────────────────
export async function listProfiles(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const profiles = await prisma.motorcycleProfile.findMany({
      orderBy: { name: "asc" },
    });

    res.json(profiles);
  } catch (err) {
    console.error("[listProfiles] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function updateMotorcycle(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;
  const { name, brand, model, year, plate, category, profileId, deviceId } = req.body;

  if (name !== undefined && (!name || typeof name !== "string")) {
    res.status(400).json({ error: "Campo 'name' é inválido" });
    return;
  }

  try {
    const existing = await prisma.motorcycle.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: "Mota não encontrada" });
      return;
    }

    let finalProfileId = profileId;
    if (finalProfileId) {
      const profile = await prisma.motorcycleProfile.findUnique({ where: { id: finalProfileId } });
      if (!profile) {
        res.status(400).json({ error: "Perfil de mota não encontrado" });
        return;
      }
    } else if (category) {
      const profile = await prisma.motorcycleProfile.findUnique({ where: { name: category } });
      if (profile) {
        finalProfileId = profile.id;
      }
    }

    const motorcycle = await prisma.motorcycle.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(brand !== undefined ? { brand: brand || null } : {}),
        ...(model !== undefined ? { model: model || null } : {}),
        ...(year !== undefined ? { year: year ? parseInt(year, 10) : null } : {}),
        ...(plate !== undefined ? { plate: plate || null } : {}),
        ...(category !== undefined ? { category: category || null } : {}),
        ...(deviceId !== undefined ? { deviceId: deviceId || null } : {}),
        ...(finalProfileId !== undefined ? { profileId: finalProfileId || null } : {}),
      },
      include: { profile: true },
    });

    res.json(motorcycle);
  } catch (err) {
    console.error("[updateMotorcycle] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}

export async function deleteMotorcycle(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const id = req.params.id as string;

  try {
    const existing = await prisma.motorcycle.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: "Mota não encontrada" });
      return;
    }

    await prisma.motorcycle.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[deleteMotorcycle] Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
  }
}
