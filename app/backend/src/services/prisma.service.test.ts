import { describe, it, expect, vi } from 'vitest';
import { prisma, pool } from './prisma.service';

describe('PrismaService', () => {
  it('should export a prisma client instance', () => {
    expect(prisma).toBeDefined();
    expect(prisma.$connect).toBeDefined();
  });

  it('should export a pg pool instance', () => {
    expect(pool).toBeDefined();
    expect(pool.on).toBeDefined();
  });
});
