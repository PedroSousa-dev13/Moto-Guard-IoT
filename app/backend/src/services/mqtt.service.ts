// =============================================================================
// MotoGuard IoT — Serviço: MQTT
// =============================================================================
// Gere a ligação ao broker Mosquitto, subscreve o tópico de telemetria e
// expõe métodos para publicar comandos.
// =============================================================================

import mqtt, { MqttClient } from "mqtt";
import { env } from "../config/env";
import { telemetryStore } from "./telemetry.store";
import type { TelemetryPayload } from "../models/telemetry.model";
import { validateTelemetryPayload } from "../utils/validate-telemetry";

export type TelemetryHandler = (payload: TelemetryPayload) => void;

class MqttService {
  private client: MqttClient | null = null;
  private _connected = false;
  private onTelemetryHandlers: TelemetryHandler[] = [];

  /** Estado da ligação MQTT */
  get connected(): boolean {
    return this._connected;
  }

  /** Regista um handler que será chamado a cada mensagem de telemetria */
  onTelemetry(handler: TelemetryHandler): void {
    this.onTelemetryHandlers.push(handler);
  }

  connect(): void {
    console.log(`A ligar ao broker MQTT: ${env.MQTT_BROKER_URL}`);

    this.client = mqtt.connect(env.MQTT_BROKER_URL, {
      username: env.MQTT_USER,
      password: env.MQTT_PASS,
      keepalive: 60,
      reconnectPeriod: 5000,
      clientId: `motoguard-backend-${Date.now()}`,
    });

    this.client.on("connect", () => {
      this._connected = true;
      console.log("MQTT conectado ao broker");

      this.client!.subscribe(env.MQTT_TOPIC_TELEMETRIA, { qos: 1 }, (err) => {
        if (err) {
          console.error("Erro ao subscrever tópico de telemetria:", err.message);
        } else {
          console.log(`Subscrito a: ${env.MQTT_TOPIC_TELEMETRIA}`);
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
      if (topic === env.MQTT_TOPIC_TELEMETRIA) {
        try {
          const raw = JSON.parse(message.toString());

          const validation = validateTelemetryPayload(raw);
          if (!validation.valid) {
            console.warn(`Payload inválido rejeitado: ${validation.error}`);
            return;
          }

          const payload = raw as TelemetryPayload;
          telemetryStore.update(payload);

          for (const handler of this.onTelemetryHandlers) {
            handler(payload);
          }

        } catch (err) {
          console.error("Erro ao parsear telemetria:", (err as Error).message);
        }
      }
    });
  }

  /** Publica um comando no tópico MQTT de comandos */
  publishCommand(command: object): boolean {
    if (!this.client || !this._connected) {
      return false;
    }

    const acao = (command as Record<string, unknown>)?.acao;
    this.client.publish(
      env.MQTT_TOPIC_COMANDO,
      JSON.stringify(command),
      { qos: 1 }
    );
    return true;
  }

  /** Desconecta o cliente MQTT. Chamado no shutdown graceful. */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this._connected = false;
    }
  }
}

// Exporta instância singleton
export const mqttService = new MqttService();
