import { describe, it, expect } from 'vitest';

describe('Auth Reset Routes', () => {
  it('deve existir e ser importável', async () => {
    const authResetRoutes = await import('../backend/src/routes/auth-reset.routes');
    expect(authResetRoutes.default).toBeDefined();
  });

  it('deve exportar um router válido', async () => {
    const authResetRoutes = await import('../backend/src/routes/auth-reset.routes');
    expect(authResetRoutes.default).toBeDefined();
    expect(typeof authResetRoutes.default).toBe('function');
  });
});