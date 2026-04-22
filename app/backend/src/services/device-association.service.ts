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

  async getAssociation(deviceId: string, userId?: string, motoModel?: string): Promise<MotorcycleAssociation | null> {
    // Para simuladores, o cacheKey deve incluir o modelo se disponível
    const isSim = deviceId.includes("-SIM-");
    const cacheKey = [deviceId, userId, isSim ? motoModel : undefined].filter(Boolean).join(":");
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const motorcycle = await prisma.motorcycle.findFirst({
      where: { 
        deviceId,
        userId: userId || undefined,
        // Se for simulador e tivermos o modelo, filtramos por nome ou categoria
        ...(isSim && motoModel ? { 
          OR: [
            { name: motoModel },
            { category: motoModel }
          ]
        } : {})
      },
      select: { id: true, userId: true, deviceId: true },
    });

    if (!motorcycle) {
      // Fallback: se não encontramos com o modelo exato, tentamos encontrar qualquer um do user
      if (isSim && motoModel && userId) {
         return this.getAssociation(deviceId, userId);
      }
      // Fallback para dispositivos reais
      if (userId && !isSim) {
        return this.getAssociation(deviceId);
      }
      console.warn(`Mota não encontrada para deviceId: ${deviceId} (user: ${userId}, model: ${motoModel})`);
      return null;
    }

    const association: MotorcycleAssociation = {
      motorcycleId: motorcycle.id,
      userId: motorcycle.userId,
      deviceId: motorcycle.deviceId!,
    };

    this.setCache(cacheKey, association);
    return association;
  }

  async registerDevice(
    deviceId: string,
    userId: string,
    motorcycleName: string,
    profileId?: string
  ): Promise<MotorcycleAssociation> {
    const isSim = deviceId.includes("-SIM-");
    
    // Para simuladores, verificamos se já existe uma mota com ESTE NOME para este user e device
    const existing = await prisma.motorcycle.findFirst({
      where: { 
        deviceId, 
        userId,
        ...(isSim ? { name: motorcycleName } : {})
      },
    });

    if (existing) {
      // Se a mota existe mas não tem categoria/perfil, vamos atualizar (migração suave)
      if (isSim && (!existing.category || !existing.profileId)) {
        const profile = await prisma.motorcycleProfile.findFirst({
          where: { name: motorcycleName }
        });
        if (profile) {
          await prisma.motorcycle.update({
            where: { id: existing.id },
            data: { category: profile.name, profileId: profile.id }
          });
        }
      }

      const association: MotorcycleAssociation = {
        motorcycleId: existing.id,
        userId: existing.userId,
        deviceId: existing.deviceId!,
      };
      const cacheKey = [deviceId, userId, isSim ? motorcycleName : undefined].filter(Boolean).join(":");
      this.setCache(cacheKey, association);
      return association;
    }

    // Tentar encontrar perfil por nome se for simulador
    let effectiveProfileId = profileId;
    let category = isSim ? motorcycleName : undefined;

    if (isSim && !effectiveProfileId) {
      const profile = await prisma.motorcycleProfile.findFirst({
        where: { name: motorcycleName }
      });
      if (profile) {
        effectiveProfileId = profile.id;
        category = profile.name;
      }
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        userId,
        name: motorcycleName,
        deviceId,
        profileId: effectiveProfileId,
        category,
      },
    });

    const association: MotorcycleAssociation = {
      motorcycleId: motorcycle.id,
      userId: motorcycle.userId,
      deviceId: motorcycle.deviceId!,
    };

    const cacheKey = [deviceId, userId, isSim ? motorcycleName : undefined].filter(Boolean).join(":");
    this.setCache(cacheKey, association);
    console.log(`Device ${deviceId} (${motorcycleName}) registado para mota ${motorcycle.id}`);
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
