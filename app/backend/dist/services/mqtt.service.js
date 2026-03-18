"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: MQTT
// =============================================================================
// Gere a ligação ao broker Mosquitto, subscreve o tópico de telemetria e
// expõe métodos para publicar comandos.
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mqttService = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const env_1 = require("../config/env");
const telemetry_store_1 = require("./telemetry.store");
const validate_telemetry_1 = require("../utils/validate-telemetry");
class MqttService {
    client = null;
    _connected = false;
    onTelemetryHandlers = [];
    /** Estado da ligação MQTT */
    get connected() {
        return this._connected;
    }
    /** Regista um handler que será chamado a cada mensagem de telemetria */
    onTelemetry(handler) {
        this.onTelemetryHandlers.push(handler);
    }
    connect() {
        console.log(`A ligar ao broker MQTT: ${env_1.env.MQTT_BROKER_URL}`);
        this.client = mqtt_1.default.connect(env_1.env.MQTT_BROKER_URL, {
            username: env_1.env.MQTT_USER,
            password: env_1.env.MQTT_PASS,
            keepalive: 60,
            reconnectPeriod: 5000,
            clientId: `motoguard-backend-${Date.now()}`,
        });
        this.client.on("connect", () => {
            this._connected = true;
            console.log("MQTT conectado ao broker");
            this.client.subscribe(env_1.env.MQTT_TOPIC_TELEMETRIA, { qos: 1 }, (err) => {
                if (err) {
                    console.error("Erro ao subscrever tópico de telemetria:", err.message);
                }
                else {
                    console.log(`Subscrito a: ${env_1.env.MQTT_TOPIC_TELEMETRIA}`);
                }
            });
        });
        this.client.on("error", (err) => {
            console.error("Erro MQTT:", err.message);
        });
        this.client.on("offline", () => {
            this._connected = false;
            console.log("MQTT desconectado - a tentar reconectar...");
        });
        this.client.on("reconnect", () => {
            console.log("MQTT a reconectar...");
        });
        this.client.on("message", (topic, message) => {
            if (topic === env_1.env.MQTT_TOPIC_TELEMETRIA) {
                try {
                    const raw = JSON.parse(message.toString());
                    const validation = (0, validate_telemetry_1.validateTelemetryPayload)(raw);
                    if (!validation.valid) {
                        console.warn(`Payload inválido rejeitado: ${validation.error}`);
                        return;
                    }
                    const payload = raw;
                    telemetry_store_1.telemetryStore.update(payload);
                    for (const handler of this.onTelemetryHandlers) {
                        handler(payload);
                    }
                    if (telemetry_store_1.telemetryStore.count % 10 === 0) {
                        const vel = payload?.telemetry?.speed_kmh ?? "?";
                        const rpm = payload?.telemetry?.rpm ?? "?";
                        const evento = payload?.system?.event_status ?? "?";
                        console.log(`[#${telemetry_store_1.telemetryStore.count}] vel=${vel} km/h | rpm=${rpm} | evento=${evento}`);
                    }
                }
                catch (err) {
                    console.error("Erro ao parsear telemetria:", err.message);
                }
            }
        });
    }
    /** Publica um comando no tópico MQTT de comandos */
    publishCommand(command) {
        if (!this.client || !this._connected) {
            return false;
        }
        const acao = command?.acao;
        const retain = acao === "definir_rota" || acao === "reset_rota";
        this.client.publish(env_1.env.MQTT_TOPIC_COMANDO, JSON.stringify(command), { qos: 1, retain });
        return true;
    }
}
// Exporta instância singleton
exports.mqttService = new MqttService();
//# sourceMappingURL=mqtt.service.js.map