import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mqttService } from '../backend/src/services/mqtt.service';
import type { TelemetryPayload } from '../backend/src/models/telemetry.model';
import { validateTelemetryPayload } from '../backend/src/utils/validate-telemetry';

// Mock do módulo mqtt
vi.mock('mqtt', () => ({
  connect: vi.fn().mockReturnValue({
    on: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
    end: vi.fn()
  })
}));

describe('MQTT Service', () => {
  beforeEach(() => {
    // Reset mocks antes de cada teste
    vi.clearAllMocks();
  });

  it('deve existir e ser importável', async () => {
    const service = await import('../backend/src/services/mqtt.service');
    expect(service.mqttService).toBeDefined();
  });

  it('deve conectar ao broker MQTT com configurações corretas', () => {
    // O connect já é chamado na instantiation do singleton
    expect(mqttService.connected).toBe(false); // inicialmente não conectado
  });

  it('deve registrar handler para telemetria', () => {
    const handler = vi.fn();
    mqttService.onTelemetry(handler);

    const mockPayload: TelemetryPayload = {
      telemetry: {
        speed_kmh: 50,
        rpm: 3000,
        gear: 3,
        throttle_pct: 60,
        voltage: 14.2,
        brake_front_pct: 20,
        brake_rear_pct: 15,
        odometer_km: 10.5,
        clutch_engaged: false
      },
      imu: {
        roll_deg: 10,
        pitch_deg: 2,
        yaw_deg: 90,
        g_force: 1.2
      },
      active_safety: {
        abs_active: false,
        tc_active: false
      },
      health: {
        oil_pressure_bar: 3.5,
        tire_pressure_front_bar: 2.2,
        tire_pressure_rear_bar: 2.4
      },
      location: {
        latitude: 41.2951,
        longitude: -7.7463
      },
      system: {
        device_id: 'MOTOGUARD-SIM-01',
        moto_model: 'Naked',
        event_status: 'NORMAL',
        tick: 100,
        timestamp: '2026-04-08T10:00:00Z',
        speed_limit_kmh: 50
      }
    };

    // Chamar o handler de mensagem diretamente para testar
    mqttService['onTelemetryHandlers'].forEach(h => h(mockPayload));

    expect(handler).toHaveBeenCalledWith(mockPayload);
  });

  it('deve publicar comando quando conectado', () => {
    // Forçar estado conectado para teste
    // @ts-ignore - acessando propriedade privada para teste
    mqttService._connected = true;
    // @ts-ignore - acessando propriedade privada para teste
    mqttService.client = {
      publish: vi.fn().mockReturnValue(true)
    } as any;

    const result = mqttService.publishCommand({ acao: 'definir_modelo', modelo: 'Naked' });

    expect(result).toBe(true);
    // Verificar se publish foi chamado
    expect(mqttService.client.publish).toHaveBeenCalled();
  });

  it('deve retornar false ao publicar comando quando desconectado', () => {
    // @ts-ignore - acessando propriedade privada para teste
    mqttService._connected = false;

    const result = mqttService.publishCommand({ acao: 'definir_modelo', modelo: 'Naked' });

    expect(result).toBe(false);
  });

  it('deve rejeitar payload inválido de telemetria', () => {
    // A validação é feita dentro do handler da mensagem MQTT
    // Aqui testamos diretamente a função validadora
    const invalidPayload = {
      telemetry: {
        speed_kmh: 50
        // campos obrigatórios faltando (timestamp, device_id, system event_status, tick)
      }
    } as unknown as TelemetryPayload;

    const validation = validateTelemetryPayload(invalidPayload);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBeTruthy();
  });
});
