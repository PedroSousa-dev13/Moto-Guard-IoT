import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deviceAssociationService } from './device-association.service';
import { prisma } from './prisma.service';

vi.mock('./prisma.service', () => ({
  prisma: {
    motorcycle: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    motorcycleProfile: {
      findFirst: vi.fn(),
    }
  },
}));

describe('DeviceAssociationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deviceAssociationService.clearCache();
  });

  it('should return cached association if available', async () => {
    const mockAssoc = { motorcycleId: 'm1', userId: 'u1', deviceId: 'd1' };
    
    // Injetar no cache (como o método é privado, usamos registerDevice ou apenas confiamos no teste seguinte)
    (prisma.motorcycle.findFirst as any).mockResolvedValue({ id: 'm1', userId: 'u1', deviceId: 'd1' });
    
    const result1 = await deviceAssociationService.getAssociation('d1', 'u1');
    expect(prisma.motorcycle.findFirst).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(mockAssoc);

    // Segunda chamada deve vir do cache
    const result2 = await deviceAssociationService.getAssociation('d1', 'u1');
    expect(prisma.motorcycle.findFirst).toHaveBeenCalledTimes(1); // Continua 1
    expect(result2).toEqual(mockAssoc);
  });

  it('should handle registration of a new device', async () => {
    (prisma.motorcycle.findFirst as any).mockResolvedValue(null);
    (prisma.motorcycle.create as any).mockResolvedValue({
      id: 'new-m-id',
      userId: 'u1',
      deviceId: 'new-d-id',
      name: 'New Moto'
    });

    const result = await deviceAssociationService.registerDevice('new-d-id', 'u1', 'New Moto');
    
    expect(prisma.motorcycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deviceId: 'new-d-id',
        userId: 'u1'
      })
    }));
    expect(result.motorcycleId).toBe('new-m-id');
  });

  it('should handle simulator devices with model fallback', async () => {
    const deviceId = 'DEVICE-SIM-123';
    (prisma.motorcycle.findFirst as any).mockResolvedValueOnce(null); // findFirst original falha
    (prisma.motorcycle.findFirst as any).mockResolvedValueOnce({ id: 'fallback-id', userId: 'u1', deviceId }); // fallback funciona

    const result = await deviceAssociationService.getAssociation(deviceId, 'u1', 'Sport');
    
    expect(result?.motorcycleId).toBe('fallback-id');
  });
});
