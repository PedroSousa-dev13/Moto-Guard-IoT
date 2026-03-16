import { describe, it, expect } from 'vitest';

describe('Auth Routes', () => {
  it('deve existir e ser importável', async () => {
    const authRoutes = await import('../backend/src/routes/auth.routes');
    expect(authRoutes.default).toBeDefined();
  });

  it('deve exportar um router válido', async () => {
    const authRoutes = await import('../backend/src/routes/auth.routes');
    expect(authRoutes.default).toBeDefined();
    expect(typeof authRoutes.default).toBe('function');
  });
});