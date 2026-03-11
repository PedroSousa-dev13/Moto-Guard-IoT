"use strict";
// =============================================================================
// MotoGuard IoT — Controller: Motorcycles (Motas)
// =============================================================================
// POST /api/motorcycles          — Associar mota ao utilizador
// GET  /api/motorcycles          — Listar motas do utilizador
// GET  /api/motorcycle-profiles  — Listar perfis/classes disponíveis
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMotorcycle = createMotorcycle;
exports.listMotorcycles = listMotorcycles;
exports.listProfiles = listProfiles;
const prisma_service_1 = require("../services/prisma.service");
// ─── Criar mota ─────────────────────────────────────────────────────────────
async function createMotorcycle(req, res) {
    const userId = req.userId;
    const { name, brand, year, profileId, deviceId } = req.body;
    if (!name) {
        res.status(400).json({ error: "Campo 'name' é obrigatório" });
        return;
    }
    // Validar que o perfil existe (se fornecido)
    if (profileId) {
        const profile = await prisma_service_1.prisma.motorcycleProfile.findUnique({
            where: { id: profileId },
        });
        if (!profile) {
            res.status(400).json({ error: "Perfil de mota não encontrado" });
            return;
        }
    }
    const motorcycle = await prisma_service_1.prisma.motorcycle.create({
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
async function listMotorcycles(req, res) {
    const userId = req.userId;
    const motorcycles = await prisma_service_1.prisma.motorcycle.findMany({
        where: { userId },
        include: { profile: true },
        orderBy: { createdAt: "desc" },
    });
    res.json(motorcycles);
}
// ─── Listar perfis de mota disponíveis ──────────────────────────────────────
async function listProfiles(_req, res) {
    const profiles = await prisma_service_1.prisma.motorcycleProfile.findMany({
        orderBy: { name: "asc" },
    });
    res.json(profiles);
}
//# sourceMappingURL=motorcycle.controller.js.map