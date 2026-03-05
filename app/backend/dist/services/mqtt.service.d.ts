import type { TelemetryPayload } from "../models/telemetry.model";
export type TelemetryHandler = (payload: TelemetryPayload) => void;
declare class MqttService {
    private client;
    private _connected;
    private onTelemetryHandlers;
    /** Estado da ligação MQTT */
    get connected(): boolean;
    /** Regista um handler que será chamado a cada mensagem de telemetria */
    onTelemetry(handler: TelemetryHandler): void;
    /** Inicia a ligação ao broker MQTT */
    connect(): void;
    /** Publica um comando no tópico MQTT de comandos */
    publishCommand(command: object): boolean;
}
export declare const mqttService: MqttService;
export {};
//# sourceMappingURL=mqtt.service.d.ts.map