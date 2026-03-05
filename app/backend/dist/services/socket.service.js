"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: Socket.IO
// =============================================================================
// Gere as ligações WebSocket com o frontend. Reencaminha telemetria MQTT
// em tempo real e recebe comandos do utilizador.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = void 0;
const socket_io_1 = require("socket.io");
const mqtt_service_1 = require("./mqtt.service");
const telemetry_store_1 = require("./telemetry.store");
class SocketService {
    io = null;
    _connectedClients = 0;
    /** Número de clientes WebSocket ligados */
    get connectedClients() {
        return this._connectedClients;
    }
    /** Inicializa o Socket.IO com o servidor HTTP */
    init(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: { origin: "*", methods: ["GET", "POST"] },
        });
        this.io.on("connection", (socket) => {
            this._connectedClients++;
            console.log(`🔌 Cliente WebSocket conectado (${this._connectedClients} total)`);
            // Enviar estado atual imediatamente ao novo cliente
            socket.emit("status", telemetry_store_1.telemetryStore.getStatus(mqtt_service_1.mqttService.connected));
            // Se já há telemetria, enviar a mais recente
            if (telemetry_store_1.telemetryStore.latest) {
                socket.emit("telemetry_update", telemetry_store_1.telemetryStore.latest);
            }
            // Receber comandos do frontend e reencaminhar via MQTT
            socket.on("send_command", (command) => {
                console.log("📤 Comando recebido do frontend:", JSON.stringify(command));
                const sent = mqtt_service_1.mqttService.publishCommand(command);
                if (!sent) {
                    socket.emit("error_msg", { message: "MQTT não está conectado" });
                }
            });
            socket.on("disconnect", () => {
                this._connectedClients--;
                console.log(`🔌 Cliente desconectado (${this._connectedClients} restantes)`);
            });
        });
        // ─── Registar handler para reencaminhar telemetria ──────────────────
        mqtt_service_1.mqttService.onTelemetry((payload) => {
            this.io?.emit("telemetry_update", payload);
        });
    }
}
// Exporta instância singleton
exports.socketService = new SocketService();
//# sourceMappingURL=socket.service.js.map