import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../services/prisma.service';

// Mock do prisma e auth middleware
vi.mock('../services/prisma.service', () => ({
  prisma: {
    trip: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock do middleware de autenticação para injetar userId
vi.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = 'test-user-id';
    next();
  },
}));

describe('Trip Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list trips for a user', async () => {
    (prisma.trip.findMany as any).mockResolvedValue([
      {
        id: 'trip-1',
        status: 'COMPLETED',
        source: 'SIMULATOR',
        startedAt: new Date(),
        endedAt: new Date(),
        distanceKm: 10,
        avgSpeedKmh: 50,
        maxSpeedKmh: 80,
        maxRollDeg: 20,
        maxGForce: 1.5,
        category: null,
        categoryConfidence: null,
        drivingStyle: null,
        motorcycle: { id: 'm1', name: 'Test', brand: 'Test', category: 'Sport', profile: null },
        events: [],
        _count: { events: 0 },
      },
    ]);

    const response = await request(app).get('/api/trips');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0].id).toBe('trip-1');
  });

  it('should return 404 for non-existent trip', async () => {
    (prisma.trip.findFirst as any).mockResolvedValue(null);

    const response = await request(app).get('/api/trips/00000000-0000-0000-0000-000000000000');
    
    expect(response.status).toBe(404);
  });
});
