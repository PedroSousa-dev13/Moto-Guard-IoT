// =============================================================================
// MotoGuard IoT — Serviço: Socket.IO
// =============================================================================
// Gere as ligações WebSocket com o frontend. Reencaminha telemetria MQTT
// em tempo real e recebe comandos do utilizador.
// =============================================================================

import { Server, Socket } from "socket.io";
import http from "http";
import { mqttService } from "./mqtt.service";
import { telemetryStore } from "./telemetry.store";
import type {
  TelemetryPayload,
  SimulatorCommand,
} from "../models/telemetry.model";

class SocketService {
  private io: Server | null = null;
  private _connectedClients = 0;

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

    // ─── Registar handler para reencaminhar telemetria ──────────────────
    mqttService.onTelemetry((payload: TelemetryPayload) => {
      this.io?.emit("telemetry_update", payload);
    });
  }
}

// Exporta instância singleton
export const socketService = new SocketService();
