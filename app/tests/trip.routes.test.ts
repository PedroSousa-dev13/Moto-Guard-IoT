import { describe, it, expect } from 'vitest';

describe('Trip Routes', () => {
  it('deve existir e ser importável', async () => {
    const tripRoutes = await import('../backend/src/routes/trip.routes');
    expect(tripRoutes.default).toBeDefined();
  });

  it('deve exportar um router válido', async () => {
    const tripRoutes = await import('../backend/src/routes/trip.routes');
    expect(tripRoutes.default).toBeDefined();
    expect(typeof tripRoutes.default).toBe('function');
  });
});