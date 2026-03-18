import { describe, it, expect } from 'vitest';

describe('Prisma Service', () => {
  it('deve existir e ser importável', async () => {
    const prismaService = await import('../backend/src/services/prisma.service');
    expect(prismaService.prisma).toBeDefined();
    expect(prismaService.pool).toBeDefined();
  });
});