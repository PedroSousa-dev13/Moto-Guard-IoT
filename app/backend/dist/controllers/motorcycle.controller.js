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
exports.updateMotorcycle = updateMotorcycle;
exports.deleteMotorcycle = deleteMotorcycle;
const prisma_service_1 = require("../services/prisma.service");
// ─── Criar mota ─────────────────────────────────────────────────────────────
async function createMotorcycle(req, res) {
    const userId = req.userId;
    const { name, brand, year, profileId, deviceId } = req.body;
    if (!name) {
        res.status(400).json({ error: "Campo 'name' é obrigatório" });
        return;
    }
    try {
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
    catch (err) {
        console.error("[createMotorcycle] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Listar motas do utilizador ─────────────────────────────────────────────
async function listMotorcycles(req, res) {
    const userId = req.userId;
    try {
        const motorcycles = await prisma_service_1.prisma.motorcycle.findMany({
            where: { userId },
            include: { profile: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(motorcycles);
    }
    catch (err) {
        console.error("[listMotorcycles] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
// ─── Listar perfis de mota disponíveis ──────────────────────────────────────
async function listProfiles(_req, res) {
    try {
        const profiles = await prisma_service_1.prisma.motorcycleProfile.findMany({
            orderBy: { name: "asc" },
        });
        res.json(profiles);
    }
    catch (err) {
        console.error("[listProfiles] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function updateMotorcycle(req, res) {
    const userId = req.userId;
    const id = req.params.id;
    const { name, brand, year, profileId, deviceId } = req.body;
    if (name !== undefined && (!name || typeof name !== "string")) {
        res.status(400).json({ error: "Campo 'name' é inválido" });
        return;
    }
    try {
        const existing = await prisma_service_1.prisma.motorcycle.findFirst({ where: { id, userId } });
        if (!existing) {
            res.status(404).json({ error: "Mota não encontrada" });
            return;
        }
        if (profileId) {
            const profile = await prisma_service_1.prisma.motorcycleProfile.findUnique({ where: { id: profileId } });
            if (!profile) {
                res.status(400).json({ error: "Perfil de mota não encontrado" });
                return;
            }
        }
        const motorcycle = await prisma_service_1.prisma.motorcycle.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(brand !== undefined ? { brand: brand || null } : {}),
                ...(year !== undefined
                    ? { year: year ? parseInt(year, 10) : null }
                    : {}),
                ...(deviceId !== undefined ? { deviceId: deviceId || null } : {}),
                ...(profileId !== undefined ? { profileId: profileId || null } : {}),
            },
            include: { profile: true },
        });
        res.json(motorcycle);
    }
    catch (err) {
        console.error("[updateMotorcycle] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
async function deleteMotorcycle(req, res) {
    const userId = req.userId;
    const id = req.params.id;
    try {
        const existing = await prisma_service_1.prisma.motorcycle.findFirst({ where: { id, userId } });
        if (!existing) {
            res.status(404).json({ error: "Mota não encontrada" });
            return;
        }
        await prisma_service_1.prisma.motorcycle.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        console.error("[deleteMotorcycle] Erro interno:", err);
        res.status(500).json({ error: "Erro interno do servidor. Tente novamente mais tarde." });
    }
}
//# sourceMappingURL=motorcycle.controller.js.map