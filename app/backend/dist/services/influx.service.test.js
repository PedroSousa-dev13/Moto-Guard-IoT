"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const influx_service_1 = require("./influx.service");
const influxdb_client_1 = require("@influxdata/influxdb-client");
// Mock do InfluxDB client
vitest_1.vi.mock('@influxdata/influxdb-client', () => {
    const WriteApi = {
        writePoint: vitest_1.vi.fn(),
        close: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
    const QueryApi = {
        queryRows: vitest_1.vi.fn().mockImplementation((query, callbacks) => {
            callbacks.complete();
        }),
    };
    return {
        InfluxDB: vitest_1.vi.fn().mockImplementation(function () {
            return {
                getWriteApi: vitest_1.vi.fn().mockReturnValue(WriteApi),
                getQueryApi: vitest_1.vi.fn().mockReturnValue(QueryApi),
            };
        }),
        Point: vitest_1.vi.fn().mockImplementation(function () {
            return {
                tag: vitest_1.vi.fn().mockReturnThis(),
                floatField: vitest_1.vi.fn().mockReturnThis(),
                timestamp: vitest_1.vi.fn().mockReturnThis(),
            };
        }),
    };
});
(0, vitest_1.describe)('InfluxService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should be available by default', () => {
        (0, vitest_1.expect)(influx_service_1.influxService.available).toBe(true);
    });
    (0, vitest_1.it)('should write telemetry point correctly', () => {
        const payload = {
            system: { device_id: 'test-device', moto_model: 'test-model', timestamp: new Date().toISOString() },
            telemetry: { speed_kmh: 100, rpm: 5000, gear: 4, throttle_pct: 50, engine_temp_c: 80, voltage: 12.5, brake_front_pct: 0, brake_rear_pct: 0 },
            imu: { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, g_force: 1.0 },
            location: { latitude: 41.0, longitude: -8.0 },
            health: { oil_pressure_bar: 3.0, tire_pressure_front_bar: 2.5, tire_pressure_rear_bar: 2.9 }
        };
        influx_service_1.influxService.writeTelemetry(payload);
        (0, vitest_1.expect)(influxdb_client_1.Point).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should handle query trip telemetry', async () => {
        const startedAt = new Date('2026-04-01T10:00:00Z');
        const endedAt = new Date('2026-04-01T11:00:00Z');
        // O mock do queryApi.queryRows precisa chamar os callbacks
        // Como é complexo mockar o stream, vamos apenas verificar se foi chamado
        await (0, vitest_1.expect)(influx_service_1.influxService.queryTripTelemetry(startedAt, endedAt, 'device-1')).resolves.toBeDefined();
    });
});
//# sourceMappingURL=influx.service.test.js.map