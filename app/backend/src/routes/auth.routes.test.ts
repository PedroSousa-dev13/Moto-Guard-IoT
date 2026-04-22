import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do middleware de autenticação para injetar userId
vi.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.userId = 'test-user-id';
    next();
  },
}));

import request from 'supertest';
import { app } from '../index';
import { prisma } from '../services/prisma.service';
// Mock do prisma
vi.mock('../services/prisma.service', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('should return 400 if login fields are missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 401 for invalid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'password123' });
    
    expect(response.status).toBe(401);
  });

  it('should get current user profile', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' });

    const response = await request(app)
      .get('/api/auth/me');
    
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('test@example.com');
  });

  it('should update profile', async () => {
    (prisma.user.update as any).mockResolvedValue({ id: 'test-user-id', name: 'New Name' });

    const response = await request(app)
      .put('/api/auth/profile')
      .send({ name: 'New Name' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('New Name');
  });
});
