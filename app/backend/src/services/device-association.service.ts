// =============================================================================
// MotoGuard IoT — Serviço: Associação Device-Mota
// =============================================================================
// Gere a associação entre device_id (do simulador) e mota no PostgreSQL.
// Necessário para ligar telemetria ao utilizador correto.
// =============================================================================

import { prisma } from "./prisma.service";

interface MotorcycleAssociation {
  motorcycleId: string;
  userId: string;
  deviceId: string;
}

class DeviceAssociationService {
  private cache = new Map<string, MotorcycleAssociation>();
  private readonly CACHE_TTL_MS = 60000;
  private cacheTimestamps = new Map<string, number>();

  async getAssociation(deviceId: string): Promise<MotorcycleAssociation | null> {
    const cached = this.getFromCache(deviceId);
    if (cached) return cached;

    const motorcycle = await prisma.motorcycle.findFirst({
      where: { deviceId },
      select: { id: true, userId: true, deviceId: true },
    });

    if (!motorcycle) {
      console.warn(`Mota não encontrada para deviceId: ${deviceId}`);
      return null;
    }

    const association: MotorcycleAssociation = {
      motorcycleId: motorcycle.id,
      userId: motorcycle.userId,
      deviceId: motorcycle.deviceId!,
    };

    this.setCache(deviceId, association);
    return association;
  }

  async registerDevice(
    deviceId: string,
    userId: string,
    motorcycleName: string,
    profileId?: string
  ): Promise<MotorcycleAssociation> {
    const existing = await prisma.motorcycle.findFirst({
      where: { deviceId },
    });

    if (existing) {
      const association: MotorcycleAssociation = {
        motorcycleId: existing.id,
        userId: existing.userId,
        deviceId: existing.deviceId!,
      };
      this.setCache(deviceId, association);
      return association;
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        userId,
        name: motorcycleName,
        deviceId,
        profileId,
      },
    });

    const association: MotorcycleAssociation = {
      motorcycleId: motorcycle.id,
      userId: motorcycle.userId,
      deviceId: motorcycle.deviceId!,
    };

    this.setCache(deviceId, association);
    console.log(`Device ${deviceId} registado para mota ${motorcycle.id}`);
    return association;
  }

  private getFromCache(deviceId: string): MotorcycleAssociation | null {
    const timestamp = this.cacheTimestamps.get(deviceId);
    if (!timestamp) return null;

    const expired = Date.now() - timestamp > this.CACHE_TTL_MS;
    if (expired) {
      this.cache.delete(deviceId);
      this.cacheTimestamps.delete(deviceId);
      return null;
    }

    return this.cache.get(deviceId) || null;
  }

  private setCache(deviceId: string, association: MotorcycleAssociation): void {
    this.cache.set(deviceId, association);
    this.cacheTimestamps.set(deviceId, Date.now());
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

export const deviceAssociationService = new DeviceAssociationService();
export type { MotorcycleAssociation };
