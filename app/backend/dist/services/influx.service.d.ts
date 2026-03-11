import type { TelemetryPayload } from "../models/telemetry.model";
declare class InfluxService {
    private client;
    private writeApi;
    private queryApi;
    constructor();
    writeTelemetry(payload: TelemetryPayload): void;
    queryTripTelemetry(startedAt: Date, endedAt: Date | null, deviceId?: string | null): Promise<Record<string, unknown>[]>;
    close(): Promise<void>;
}
export declare const influxService: InfluxService;
export {};
//# sourceMappingURL=influx.service.d.ts.map