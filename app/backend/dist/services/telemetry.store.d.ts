import type { TelemetryPayload, BackendStatus } from "../models/telemetry.model";
declare class TelemetryStore {
    private _latest;
    private _count;
    /** Atualiza com novo payload recebido do MQTT */
    update(payload: TelemetryPayload): void;
    /** Último payload recebido */
    get latest(): TelemetryPayload | null;
    /** Total de mensagens recebidas desde o arranque */
    get count(): number;
    /** Indica se já existe pelo menos um payload recebido */
    get hasData(): boolean;
    /** Estado resumido para enviar ao frontend */
    getStatus(mqttConnected: boolean): BackendStatus;
    clearLatest(): void;
    clearLatestIfDevice(deviceId: string | null): void;
}
export declare const telemetryStore: TelemetryStore;
export {};
//# sourceMappingURL=telemetry.store.d.ts.map