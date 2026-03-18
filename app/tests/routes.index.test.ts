import { describe, it, expect } from 'vitest';

describe('Routes Index', () => {
  it('deve existir e ser importável', async () => {
    const routes = await import('../backend/src/routes/index');
    expect(routes.default).toBeDefined();
  });

  it('deve exportar um router válido', async () => {
    const routes = await import('../backend/src/routes/index');
    expect(routes.default).toBeDefined();
    expect(typeof routes.default).toBe('function');
  });
});