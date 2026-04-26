"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const device_association_service_1 = require("./device-association.service");
const prisma_service_1 = require("./prisma.service");
vitest_1.vi.mock('./prisma.service', () => ({
    prisma: {
        motorcycle: {
            findFirst: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
        },
        motorcycleProfile: {
            findFirst: vitest_1.vi.fn(),
        }
    },
}));
(0, vitest_1.describe)('DeviceAssociationService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        device_association_service_1.deviceAssociationService.clearCache();
    });
    (0, vitest_1.it)('should return cached association if available', async () => {
        const mockAssoc = { motorcycleId: 'm1', userId: 'u1', deviceId: 'd1' };
        // Injetar no cache (como o método é privado, usamos registerDevice ou apenas confiamos no teste seguinte)
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValue({ id: 'm1', userId: 'u1', deviceId: 'd1' });
        const result1 = await device_association_service_1.deviceAssociationService.getAssociation('d1', 'u1');
        (0, vitest_1.expect)(prisma_service_1.prisma.motorcycle.findFirst).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(result1).toEqual(mockAssoc);
        // Segunda chamada deve vir do cache
        const result2 = await device_association_service_1.deviceAssociationService.getAssociation('d1', 'u1');
        (0, vitest_1.expect)(prisma_service_1.prisma.motorcycle.findFirst).toHaveBeenCalledTimes(1); // Continua 1
        (0, vitest_1.expect)(result2).toEqual(mockAssoc);
    });
    (0, vitest_1.it)('should handle registration of a new device', async () => {
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValue(null);
        prisma_service_1.prisma.motorcycle.create.mockResolvedValue({
            id: 'new-m-id',
            userId: 'u1',
            deviceId: 'new-d-id',
            name: 'New Moto'
        });
        const result = await device_association_service_1.deviceAssociationService.registerDevice('new-d-id', 'u1', 'New Moto');
        (0, vitest_1.expect)(prisma_service_1.prisma.motorcycle.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            data: vitest_1.expect.objectContaining({
                deviceId: 'new-d-id',
                userId: 'u1'
            })
        }));
        (0, vitest_1.expect)(result.motorcycleId).toBe('new-m-id');
    });
    (0, vitest_1.it)('should handle simulator devices with model fallback', async () => {
        const deviceId = 'DEVICE-SIM-123';
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValueOnce(null); // findFirst original falha
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValueOnce({ id: 'fallback-id', userId: 'u1', deviceId }); // fallback funciona
        const result = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, 'u1', 'Sport');
        (0, vitest_1.expect)(result?.motorcycleId).toBe('fallback-id');
    });
});
//# sourceMappingURL=device-association.service.test.js.map