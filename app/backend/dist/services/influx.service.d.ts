import type { TelemetryPayload } from "../models/telemetry.model";
declare class InfluxService {
    private client;
    private writeApi;
    private queryApi;
    private _available;
    constructor();
    get available(): boolean;
    writeTelemetry(payload: TelemetryPayload): void;
    queryTripTelemetry(startedAt: Date, endedAt: Date | null, deviceId?: string | null): Promise<Record<string, unknown>[]>;
    ensureBucket(): Promise<void>;
    close(): Promise<void>;
}
export declare const influxService: InfluxService;
export {};
//# sourceMappingURL=influx.service.d.ts.map