"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: Socket.IO
// =============================================================================
// Gere as ligações WebSocket com o frontend. Reencaminha telemetria MQTT
// em tempo real, emite eventos de alerta/viagem e recebe comandos.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = void 0;
const socket_io_1 = require("socket.io");
const mqtt_service_1 = require("./mqtt.service");
const telemetry_store_1 = require("./telemetry.store");
class SocketService {
    io = null;
    _connectedClients = 0;
    tripActiveByDevice = new Map();
    stationaryTicksByDevice = new Map();
    lastEventStatusByDevice = new Map();
    // Thresholds simples para ciclo de viagem em tempo real.
    static TRIP_START_SPEED_KMH = 5;
    static TRIP_END_SPEED_KMH = 2;
    static TRIP_END_STATIONARY_TICKS = 10;
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
        // Reencaminhar telemetria e derivar eventos em tempo real.
        mqtt_service_1.mqttService.onTelemetry((payload) => {
            this.io?.emit("telemetry_update", payload);
            this.handleAlertEvent(payload);
            this.handleTripLifecycle(payload);
        });
    }
    handleAlertEvent(payload) {
        const deviceId = payload.system.device_id;
        const status = this.normalizeEventStatus(payload.system.event_status);
        const previousStatus = this.lastEventStatusByDevice.get(deviceId) ?? "NORMAL";
        if (status !== "NORMAL" && status !== previousStatus) {
            const alert = {
                status,
                deviceId,
                motoModel: payload.system.moto_model,
                timestamp: payload.system.timestamp,
            };
            this.io?.emit("alert", alert);
        }
        this.lastEventStatusByDevice.set(deviceId, status);
    }
    handleTripLifecycle(payload) {
        const deviceId = payload.system.device_id;
        const speed = payload.telemetry.speed_kmh;
        const tripActive = this.tripActiveByDevice.get(deviceId) ?? false;
        if (!tripActive && speed >= SocketService.TRIP_START_SPEED_KMH) {
            const started = {
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
            const stationaryTicks = (this.stationaryTicksByDevice.get(deviceId) ?? 0) + 1;
            this.stationaryTicksByDevice.set(deviceId, stationaryTicks);
            if (stationaryTicks >= SocketService.TRIP_END_STATIONARY_TICKS) {
                const ended = {
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
    normalizeEventStatus(status) {
        const trimmed = status.trim();
        if (!trimmed) {
            return "NORMAL";
        }
        return trimmed.toUpperCase();
    }
}
// Exporta instância singleton
exports.socketService = new SocketService();
//# sourceMappingURL=socket.service.js.map