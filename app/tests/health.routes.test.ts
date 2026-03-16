import { describe, it, expect } from 'vitest';

describe('Health Routes', () => {
  it('deve existir e ser importável', async () => {
    const healthRoutes = await import('../backend/src/routes/health.routes');
    expect(healthRoutes.default).toBeDefined();
    expect(typeof healthRoutes.default).toBe('function');
  });
});