import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { influxService } from '../backend/src/services/influx.service';
import type { TelemetryPayload } from '../backend/src/models/telemetry.model';

// Mock do módulo influxdb-client - must be a class constructor
vi.mock('@influxdata/influxdb-client', () => {
  const mockWriteApi = {
    writePoint: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  };

  const mockQueryApi = {
    queryRows: vi.fn().mockImplementation((query, callbacks) => {
      callbacks.next?.([], { toObject: () => ({}) } as any);
      callbacks.complete?.();
      return Promise.resolve();
    })
  };

  const MockInfluxDB = vi.fn().mockImplementation(() => ({
    getWriteApi: vi.fn().mockReturnValue(mockWriteApi),
    getQueryApi: vi.fn().mockReturnValue(mockQueryApi)
  }));

  return {
    InfluxDB: MockInfluxDB as any,
    Point: vi.fn(),
    WriteApi: vi.fn(),
    QueryApi: vi.fn(),
  };
});

// Mock do fetch para o método ensureBucket
global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe('InfluxDB Service', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset private state
    influxService._available = true;
    // @ts-ignore - reset writeApi ref
    influxService.writeApi = (influxService as any).client.getWriteApi(vi.fn(), vi.fn(), 'ms', {});
    // @ts-ignore - reset queryApi ref
    influxService.queryApi = (influxService as any).client.getQueryApi();
  });

  it('deve existir e ser importável', async () => {
    const service = await import('../backend/src/services/influx.service');
    expect(service.influxService).toBeDefined();
  });

  it('deve escrever telemetria quando disponível', () => {
    influxService.writeTelemetry(mockPayload);
    expect(influxService.writeApi.writePoint).toHaveBeenCalled();
  });

  it('não deve escrever telemetria quando indisponível', () => {
    // @ts-ignore - force unavailable
    influxService._available = false;
    influxService.writeTelemetry(mockPayload);
    // mockWriteApi still exists, but the service short-circuits before calling it
    expect(influxService.writeApi.writePoint).not.toHaveBeenCalled();
  });

  it('deve retornar array vazio ao consultar telemetria quando indisponível', async () => {
    // @ts-ignore - force unavailable
    influxService._available = false;
    const result = await influxService.queryTripTelemetry(
      new Date('2026-04-08T10:00:00Z'),
      new Date('2026-04-08T10:05:00Z')
    );
    expect(result).toEqual([]);
  });

  it('deve consultar telemetria com parâmetros corretos', async () => {
    const startedAt = new Date('2026-04-08T10:00:00Z');
    const endedAt = new Date('2026-04-08T10:05:00Z');
    const deviceId = 'MOTOGUARD-SIM-01';

    await influxService.queryTripTelemetry(startedAt, endedAt, deviceId);

    expect(influxService.queryApi.queryRows).toHaveBeenCalled();
    const [query] = influxService.queryApi.queryRows.mock.calls[0];
    const queryStr = String(query);
    expect(queryStr).toContain('from(bucket:');
    expect(queryStr).toContain('range(start:');
    expect(queryStr).toContain('filter(fn: (r) => r._measurement == "telemetry")');
  });

  it('deve fechar corretamente o writeApi', async () => {
    await influxService.close();
    expect(influxService.writeApi.close).toHaveBeenCalled();
  });
});
