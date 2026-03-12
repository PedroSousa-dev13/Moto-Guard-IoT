interface MotorcycleAssociation {
    motorcycleId: string;
    userId: string;
    deviceId: string;
}
declare class DeviceAssociationService {
    private cache;
    private readonly CACHE_TTL_MS;
    private cacheTimestamps;
    getAssociation(deviceId: string): Promise<MotorcycleAssociation | null>;
    registerDevice(deviceId: string, userId: string, motorcycleName: string, profileId?: string): Promise<MotorcycleAssociation>;
    private getFromCache;
    private setCache;
    clearCache(): void;
}
export declare const deviceAssociationService: DeviceAssociationService;
export type { MotorcycleAssociation };
//# sourceMappingURL=device-association.service.d.ts.map