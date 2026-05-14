import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { influxService } from '../services/influx.service';
import { telemetryStore } from '../services/telemetry.store';

vi.mock('../services/influx.service', () => ({
  influxService: {
    queryTripTelemetry: vi.fn(),
    available: true,
  },
}));

vi.mock('../services/prisma.service', () => ({
  prisma: {
    trip: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    motorcycle: {
      findFirst: vi.fn(),
    },
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = 'test-user-id';
    next();
  },
}));

describe('Telemetry Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get latest telemetry', async () => {
    // Mock do store
    telemetryStore.update({ system: { device_id: 'd1', timestamp: new Date().toISOString() } } as any);

    const response = await request(app).get('/api/telemetry/latest');
    
    expect(response.status).toBe(200);
    expect(response.body.data.system.device_id).toBe('d1');
  });

  it('should get trip telemetry from influx', async () => {
    (influxService.queryTripTelemetry as any).mockResolvedValue([{ speed: 50 }]);
    
    const { prisma } = await import('../services/prisma.service');
    (prisma.trip.findFirst as any).mockResolvedValue({ 
      id: 't1', 
      userId: 'test-user-id', 
      startedAt: new Date(),
      source: 'DEVICE_REAL'
    });
    (prisma.motorcycle.findFirst as any).mockResolvedValue({ deviceId: 'd1' });

    const response = await request(app).get('/api/telemetry/t1');
    
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });
});
