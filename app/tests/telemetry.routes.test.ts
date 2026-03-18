import { describe, it, expect } from 'vitest';

describe('Telemetry Routes', () => {
  it('deve existir e ser importável', async () => {
    const telemetryRoutes = await import('../backend/src/routes/telemetry.routes');
    expect(telemetryRoutes.default).toBeDefined();
  });

  it('deve exportar um router válido', async () => {
    const telemetryRoutes = await import('../backend/src/routes/telemetry.routes');
    expect(telemetryRoutes.default).toBeDefined();
    expect(typeof telemetryRoutes.default).toBe('function');
  });
});