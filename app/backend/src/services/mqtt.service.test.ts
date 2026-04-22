import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mqttService } from './mqtt.service';
import mqtt from 'mqtt';

// Mock do mqtt.connect
vi.mock('mqtt', () => {
  const client = {
    on: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn().mockReturnValue(client),
    },
    connect: vi.fn().mockReturnValue(client),
  };
});

describe('MqttService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be disconnected by default', () => {
    expect(mqttService.connected).toBe(false);
  });

  it('should call mqtt.connect when connect() is called', () => {
    mqttService.connect();
    expect(mqtt.connect).toHaveBeenCalled();
  });

  it('should publish commands when connected', () => {
    mqttService.connect();
    const mockClient: any = (mqtt.connect as any).mock.results[0].value;
    const connectHandler = mockClient.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
    
    connectHandler(); // Simula conexão
    
    expect(mqttService.connected).toBe(true);
    
    const command = { acao: 'test' };
    const result = mqttService.publishCommand(command);
    
    expect(result).toBe(true);
    expect(mockClient.publish).toHaveBeenCalled();
  });
});
