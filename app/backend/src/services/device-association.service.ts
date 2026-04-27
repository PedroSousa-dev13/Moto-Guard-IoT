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
    const isSim = deviceId.toUpperCase().includes("-SIM-");
    const cleanModel = typeof motoModel === "string" ? motoModel.trim() : String(motoModel ?? "").trim();
    const cacheKey = [deviceId, userId, isSim ? (cleanModel || undefined) : undefined].filter(Boolean).join(":");
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const motorcycle = await prisma.motorcycle.findFirst({
      where: { 
        deviceId,
        userId: userId || undefined,
        // Se for simulador e tivermos o modelo, filtramos por nome ou categoria (case-insensitive via Prisma se suportado, senão exato)
        ...(isSim && cleanModel ? { 
          OR: [
            { name: { equals: cleanModel, mode: "insensitive" } },
            { category: { equals: cleanModel, mode: "insensitive" } }
          ]
        } : {})
      },
      select: { id: true, userId: true, deviceId: true },
    });

    if (!motorcycle) {
      // Fallback: se não encontramos com o modelo exato, tentamos encontrar qualquer um do user para este device
      if (isSim && userId) {
         const fallback = await prisma.motorcycle.findFirst({
           where: { deviceId, userId },
           select: { id: true, userId: true, deviceId: true },
         });
         if (fallback) {
           const assoc = { motorcycleId: fallback.id, userId: fallback.userId, deviceId: fallback.deviceId! };
           this.setCache(cacheKey, assoc);
           return assoc;
         }
      }
      
      console.warn(`[getAssociation] Mota não encontrada para deviceId: ${deviceId} (user: ${userId}, model: ${cleanModel})`);
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

  /**
   * Regista ou associa um dispositivo a um utilizador e modelo de mota.
   * Se a mota já existir (por nome ou categoria), associa. Caso contrário, cria uma nova.
   */
  async registerDevice(deviceId: string, userId: string, motorcycleName: string, profileId?: string): Promise<MotorcycleAssociation> {
    const isSim = deviceId.toUpperCase().includes("-SIM-");
    const cleanName = motorcycleName?.trim() || "Simulador";

    // 1. Verificar se já existe uma mota com este deviceId E este utilizador
    // Para simuladores, tentamos ser específicos com o nome ou categoria
    const existing = await prisma.motorcycle.findFirst({
      where: { 
        deviceId, 
        userId,
        ...(isSim ? { 
          OR: [
            { name: { equals: cleanName, mode: "insensitive" } },
            { category: { equals: cleanName, mode: "insensitive" } }
          ]
        } : {})
      },
    });

    if (existing) {
      console.log(`[registerDevice] Usando mota existente: ${existing.name} (${existing.id}) para ${deviceId}`);
      const association: MotorcycleAssociation = {
        motorcycleId: existing.id,
        userId: existing.userId,
        deviceId: existing.deviceId!,
      };
      
      const cacheKey = [deviceId, userId, isSim ? cleanName : undefined].filter(Boolean).join(":");
      this.setCache(cacheKey, association);
      return association;
    }

    // 2. Se for simulador e não encontramos pelo nome, tentamos encontrar QUALQUER mota do utilizador com este deviceId
    if (isSim) {
      const anyMotoWithId = await prisma.motorcycle.findFirst({
        where: { deviceId, userId }
      });
      if (anyMotoWithId) {
        console.log(`[registerDevice] Fallback para mota do user com mesmo deviceId: ${anyMotoWithId.name}`);
        const association = { motorcycleId: anyMotoWithId.id, userId: anyMotoWithId.userId, deviceId: anyMotoWithId.deviceId! };
        const cacheKey = [deviceId, userId, cleanName].join(":");
        this.setCache(cacheKey, association);
        return association;
      }
    }

    // 3. Criar nova mota se não existir nenhuma compatível
    console.log(`[registerDevice] Criando nova mota para simulator: ${cleanName} (${deviceId})`);
    
    let effectiveProfileId = profileId;
    let category = isSim ? cleanName : undefined;

    // Tentar encontrar perfil por nome se não fornecido
    if (isSim && !effectiveProfileId) {
      const profile = await prisma.motorcycleProfile.findFirst({
        where: { name: { equals: cleanName, mode: "insensitive" } }
      });
      if (profile) {
        effectiveProfileId = profile.id;
        category = profile.name;
      }
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        userId,
        name: cleanName,
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

    const cacheKey = [deviceId, userId, isSim ? cleanName : undefined].filter(Boolean).join(":");
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
