import { describe, it, expect } from 'vitest';

describe('Motorcycle Routes', () => {
  it('deve existir e ser importável', async () => {
    const motorcycleRoutes = await import('../backend/src/routes/motorcycle.routes');
    expect(motorcycleRoutes.default).toBeDefined();
  });
  
  it('deve exportar um router válido', async () => {
    const motorcycleRoutes = await import('../backend/src/routes/motorcycle.routes');
    expect(motorcycleRoutes.default).toBeDefined();
    expect(typeof motorcycleRoutes.default).toBe('function');
  });
});