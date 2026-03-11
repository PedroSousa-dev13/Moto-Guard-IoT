// =============================================================================
// MotoGuard IoT — Serviço: Socket.IO
// =============================================================================
// Gere as ligações WebSocket com o frontend. Reencaminha telemetria MQTT
// em tempo real, emite eventos de alerta/viagem e recebe comandos.
// =============================================================================

import { Server, Socket } from "socket.io";
import http from "http";
import { mqttService } from "./mqtt.service";
import { telemetryStore } from "./telemetry.store";
import type {
  TelemetryPayload,
  SimulatorCommand,
} from "../models/telemetry.model";

interface AlertEvent {
  status: string;
  deviceId: string;
  motoModel: string;
  timestamp: string;
}

interface TripEvent {
  deviceId: string;
  motoModel: string;
  timestamp: string;
}

class SocketService {
  private io: Server | null = null;
  private _connectedClients = 0;
  private tripActiveByDevice = new Map<string, boolean>();
  private stationaryTicksByDevice = new Map<string, number>();
  private lastEventStatusByDevice = new Map<string, string>();

  // Thresholds simples para ciclo de viagem em tempo real.
  private static readonly TRIP_START_SPEED_KMH = 5;
  private static readonly TRIP_END_SPEED_KMH = 2;
  private static readonly TRIP_END_STATIONARY_TICKS = 10;

  /** Número de clientes WebSocket ligados */
  get connectedClients(): number {
    return this._connectedClients;
  }

  /** Inicializa o Socket.IO com o servidor HTTP */
  init(httpServer: http.Server): void {
    this.io = new Server(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    this.io.on("connection", (socket: Socket) => {
      this._connectedClients++;
      console.log(
        `🔌 Cliente WebSocket conectado (${this._connectedClients} total)`
      );

      // Enviar estado atual imediatamente ao novo cliente
      socket.emit("status", telemetryStore.getStatus(mqttService.connected));

      // Se já há telemetria, enviar a mais recente
      if (telemetryStore.latest) {
        socket.emit("telemetry_update", telemetryStore.latest);
      }

      // Receber comandos do frontend e reencaminhar via MQTT
      socket.on("send_command", (command: SimulatorCommand) => {
        console.log(
          "📤 Comando recebido do frontend:",
          JSON.stringify(command)
        );
        const sent = mqttService.publishCommand(command);
        if (!sent) {
          socket.emit("error_msg", { message: "MQTT não está conectado" });
        }
      });

      socket.on("disconnect", () => {
        this._connectedClients--;
        console.log(
          `🔌 Cliente desconectado (${this._connectedClients} restantes)`
        );
      });
    });

    // Reencaminhar telemetria e derivar eventos em tempo real.
    mqttService.onTelemetry((payload: TelemetryPayload) => {
      this.io?.emit("telemetry_update", payload);
      this.handleAlertEvent(payload);
      this.handleTripLifecycle(payload);
    });
  }

  private handleAlertEvent(payload: TelemetryPayload): void {
    const deviceId = payload.system.device_id;
    const status = this.normalizeEventStatus(payload.system.event_status);
    const previousStatus = this.lastEventStatusByDevice.get(deviceId) ?? "NORMAL";

    if (status !== "NORMAL" && status !== previousStatus) {
      const alert: AlertEvent = {
        status,
        deviceId,
        motoModel: payload.system.moto_model,
        timestamp: payload.system.timestamp,
      };
      this.io?.emit("alert", alert);
    }

    this.lastEventStatusByDevice.set(deviceId, status);
  }

  private handleTripLifecycle(payload: TelemetryPayload): void {
    const deviceId = payload.system.device_id;
    const speed = payload.telemetry.speed_kmh;
    const tripActive = this.tripActiveByDevice.get(deviceId) ?? false;

    if (!tripActive && speed >= SocketService.TRIP_START_SPEED_KMH) {
      const started: TripEvent = {
        deviceId,
        motoModel: payload.system.moto_model,
        timestamp: payload.system.timestamp,
      };
      this.tripActiveByDevice.set(deviceId, true);
      this.stationaryTicksByDevice.set(deviceId, 0);
      this.io?.emit("trip_started", started);
      return;
    }

    if (!tripActive) {
      return;
    }

    if (speed <= SocketService.TRIP_END_SPEED_KMH) {
      const stationaryTicks =
        (this.stationaryTicksByDevice.get(deviceId) ?? 0) + 1;
      this.stationaryTicksByDevice.set(deviceId, stationaryTicks);

      if (stationaryTicks >= SocketService.TRIP_END_STATIONARY_TICKS) {
        const ended: TripEvent = {
          deviceId,
          motoModel: payload.system.moto_model,
          timestamp: payload.system.timestamp,
        };
        this.tripActiveByDevice.set(deviceId, false);
        this.stationaryTicksByDevice.set(deviceId, 0);
        this.io?.emit("trip_ended", ended);
      }
      return;
    }

    this.stationaryTicksByDevice.set(deviceId, 0);
  }

  private normalizeEventStatus(status: string): string {
    const trimmed = status.trim();
    if (!trimmed) {
      return "NORMAL";
    }
    return trimmed.toUpperCase();
  }
}

// Exporta instância singleton
export const socketService = new SocketService();
