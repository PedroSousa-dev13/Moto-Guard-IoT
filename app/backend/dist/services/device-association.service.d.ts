interface MotorcycleAssociation {
    motorcycleId: string;
    userId: string;
    deviceId: string;
}
declare class DeviceAssociationService {
    private cache;
    private readonly CACHE_TTL_MS;
    private cacheTimestamps;
    getAssociation(deviceId: string, userId?: string, motoModel?: string): Promise<MotorcycleAssociation | null>;
    /**
     * Regista ou associa um dispositivo a um utilizador e modelo de mota.
     * Se a mota já existir (por nome ou categoria), associa. Caso contrário, cria uma nova.
     */
    registerDevice(deviceId: string, userId: string, motorcycleName: string, profileId?: string): Promise<MotorcycleAssociation>;
    private getFromCache;
    private setCache;
    clearCache(): void;
}
export declare const deviceAssociationService: DeviceAssociationService;
export type { MotorcycleAssociation };
//# sourceMappingURL=device-association.service.d.ts.map