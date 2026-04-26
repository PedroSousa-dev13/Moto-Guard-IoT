import type { TelemetryPayload } from "../models/telemetry.model";
declare class RealtimeAnomalyService {
    private buffers;
    private readonly BUFFER_SIZE;
    private tickCounters;
    /**
     * Processa nova telemetria para deteção de anomalias em tempo real.
     */
    processTelemetry(payload: TelemetryPayload): Promise<void>;
    private runRealtimeInference;
}
export declare const realtimeAnomalyService: RealtimeAnomalyService;
export {};
//# sourceMappingURL=realtime-anomaly.service.d.ts.map