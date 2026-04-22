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
      { id: 'trip-1', status: 'COMPLETED', startedAt: new Date() },
    ]);

    const response = await request(app).get('/api/trips');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].id).toBe('trip-1');
  });

  it('should return 404 for non-existent trip', async () => {
    (prisma.trip.findFirst as any).mockResolvedValue(null);

    const response = await request(app).get('/api/trips/non-existent');
    
    expect(response.status).toBe(404);
  });
});
