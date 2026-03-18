import { describe, it, expect } from 'vitest';

describe('Command Routes', () => {
  it('deve existir e ser importável', async () => {
    const commandRoutes = await import('../backend/src/routes/command.routes');
    expect(commandRoutes.default).toBeDefined();
  });
  
  it('deve exportar um router válido', async () => {
    const commandRoutes = await import('../backend/src/routes/command.routes');
    expect(commandRoutes.default).toBeDefined();
    expect(typeof commandRoutes.default).toBe('function');
  });
});