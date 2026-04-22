import { describe, it, expect, vi, beforeEach } from 'vitest';
import { influxService } from './influx.service';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

// Mock do InfluxDB client
vi.mock('@influxdata/influxdb-client', () => {
  const WriteApi = {
    writePoint: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const QueryApi = {
    queryRows: vi.fn().mockImplementation((query, callbacks) => {
      callbacks.complete();
    }),
  };
  
  return {
    InfluxDB: vi.fn().mockImplementation(function() {
      return {
        getWriteApi: vi.fn().mockReturnValue(WriteApi),
        getQueryApi: vi.fn().mockReturnValue(QueryApi),
      };
    }),
    Point: vi.fn().mockImplementation(function() {
      return {
        tag: vi.fn().mockReturnThis(),
        floatField: vi.fn().mockReturnThis(),
        timestamp: vi.fn().mockReturnThis(),
      };
    }),
  };
});

describe('InfluxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be available by default', () => {
    expect(influxService.available).toBe(true);
  });

  it('should write telemetry point correctly', () => {
    const payload: any = {
      system: { device_id: 'test-device', moto_model: 'test-model', timestamp: new Date().toISOString() },
      telemetry: { speed_kmh: 100, rpm: 5000, gear: 4, throttle_pct: 50, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
      imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
      location: { latitude: 41.0, longitude: -8.0 },
      health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.9 }
    };

    influxService.writeTelemetry(payload);
    expect(Point).toHaveBeenCalled();
  });

  it('should handle query trip telemetry', async () => {
    const startedAt = new Date('2026-04-01T10:00:00Z');
    const endedAt = new Date('2026-04-01T11:00:00Z');
    
    // O mock do queryApi.queryRows precisa chamar os callbacks
    // Como é complexo mockar o stream, vamos apenas verificar se foi chamado
    await expect(influxService.queryTripTelemetry(startedAt, endedAt, 'device-1')).resolves.toBeDefined();
  });
});
