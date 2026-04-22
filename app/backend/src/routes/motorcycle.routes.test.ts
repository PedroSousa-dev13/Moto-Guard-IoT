import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../services/prisma.service';

vi.mock('../services/prisma.service', () => ({
  prisma: {
    motorcycle: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    motorcycleProfile: {
      findMany: vi.fn(),
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

describe('Motorcycle Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list motorcycles for a user', async () => {
    (prisma.motorcycle.findMany as any).mockResolvedValue([
      { id: 'm1', name: 'Yamaha R6', brand: 'Yamaha' }
    ]);

    const response = await request(app).get('/api/motorcycles');
    
    expect(response.status).toBe(200);
    expect(response.body[0].name).toBe('Yamaha R6');
  });

  it('should create a new motorcycle', async () => {
    (prisma.motorcycle.create as any).mockResolvedValue({ id: 'm2', name: 'Honda CBR' });

    const response = await request(app)
      .post('/api/motorcycles')
      .send({ name: 'Honda CBR', brand: 'Honda', category: 'Sport' });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Honda CBR');
  });

  it('should list user profiles', async () => {
    (prisma.motorcycleProfile.findMany as any).mockResolvedValue([{ id: 'p1', name: 'Sport' }]);

    const response = await request(app).get('/api/motorcycle-profiles');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Sport');
  });

  it('should update a motorcycle', async () => {
    (prisma.motorcycle.findFirst as any).mockResolvedValue({ id: 'm1', userId: 'test-user-id' });
    (prisma.motorcycle.update as any).mockResolvedValue({ id: 'm1', name: 'Updated Name' });

    const response = await request(app)
      .put('/api/motorcycles/m1')
      .send({ name: 'Updated Name' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
  });

  it('should delete a motorcycle', async () => {
    (prisma.motorcycle.findFirst as any).mockResolvedValue({ id: 'm1', userId: 'test-user-id' });
    (prisma.motorcycle.delete as any).mockResolvedValue({ id: 'm1' });

    const response = await request(app).delete('/api/motorcycles/m1');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
