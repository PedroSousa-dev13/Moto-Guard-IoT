import { describe, it, expect } from 'vitest';

describe('MQTT Service', () => {
  it('deve existir e ser importável', async () => {
    const mqttService = await import('../backend/src/services/mqtt.service');
    expect(mqttService.mqttService).toBeDefined();
  });
});