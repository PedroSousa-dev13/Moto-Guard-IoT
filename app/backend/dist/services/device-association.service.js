"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: Associação Device-Mota
// =============================================================================
// Gere a associação entre device_id (do simulador) e mota no PostgreSQL.
// Necessário para ligar telemetria ao utilizador correto.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceAssociationService = void 0;
const prisma_service_1 = require("./prisma.service");
class DeviceAssociationService {
    cache = new Map();
    CACHE_TTL_MS = 60000;
    cacheTimestamps = new Map();
    async getAssociation(deviceId) {
        const cached = this.getFromCache(deviceId);
        if (cached)
            return cached;
        const motorcycle = await prisma_service_1.prisma.motorcycle.findFirst({
            where: { deviceId },
            select: { id: true, userId: true, deviceId: true },
        });
        if (!motorcycle) {
            console.warn(`Mota não encontrada para deviceId: ${deviceId}`);
            return null;
        }
        const association = {
            motorcycleId: motorcycle.id,
            userId: motorcycle.userId,
            deviceId: motorcycle.deviceId,
        };
        this.setCache(deviceId, association);
        return association;
    }
    async registerDevice(deviceId, userId, motorcycleName, profileId) {
        const existing = await prisma_service_1.prisma.motorcycle.findFirst({
            where: { deviceId },
        });
        if (existing) {
            const association = {
                motorcycleId: existing.id,
                userId: existing.userId,
                deviceId: existing.deviceId,
            };
            this.setCache(deviceId, association);
            return association;
        }
        const motorcycle = await prisma_service_1.prisma.motorcycle.create({
            data: {
                userId,
                name: motorcycleName,
                deviceId,
                profileId,
            },
        });
        const association = {
            motorcycleId: motorcycle.id,
            userId: motorcycle.userId,
            deviceId: motorcycle.deviceId,
        };
        this.setCache(deviceId, association);
        console.log(`Device ${deviceId} registado para mota ${motorcycle.id}`);
        return association;
    }
    getFromCache(deviceId) {
        const timestamp = this.cacheTimestamps.get(deviceId);
        if (!timestamp)
            return null;
        const expired = Date.now() - timestamp > this.CACHE_TTL_MS;
        if (expired) {
            this.cache.delete(deviceId);
            this.cacheTimestamps.delete(deviceId);
            return null;
        }
        return this.cache.get(deviceId) || null;
    }
    setCache(deviceId, association) {
        this.cache.set(deviceId, association);
        this.cacheTimestamps.set(deviceId, Date.now());
    }
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }
}
exports.deviceAssociationService = new DeviceAssociationService();
//# sourceMappingURL=device-association.service.js.map