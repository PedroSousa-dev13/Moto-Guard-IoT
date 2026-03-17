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
const prisma_service_1 = require("./prisma.service");
const device_association_service_1 = require("./device-association.service");
class SocketService {
    io = null;
    _connectedClients = 0;
    tripActiveByDevice = new Map();
    stationaryTicksByDevice = new Map();
    lastEventStatusByDevice = new Map();
    lastTelemetryByDevice = new Map();
    activeTripIdByDevice = new Map(); // Persistência: tripId atual
    tripStatsByDevice = new Map();
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
            console.log(`Cliente WebSocket conectado (${this._connectedClients} total)`);
            socket.emit("status", telemetry_store_1.telemetryStore.getStatus(mqtt_service_1.mqttService.connected));
            if (telemetry_store_1.telemetryStore.latest) {
                socket.emit("telemetry_update", telemetry_store_1.telemetryStore.latest);
            }
            socket.on("send_command", (command) => {
                console.log("Comando recebido do frontend:", JSON.stringify(command));
                const sent = mqtt_service_1.mqttService.publishCommand(command);
                if (!sent) {
                    socket.emit("error_msg", { message: "MQTT não está conectado" });
                    return;
                }
                if (command?.acao === "parar") {
                    void this.forceEndTripsOnStopCommand()
                        .catch((error) => console.error("Erro ao forçar fim de viagem:", error));
                }
            });
            socket.on("disconnect", () => {
                this._connectedClients--;
                console.log(`Cliente desconectado (${this._connectedClients} restantes)`);
            });
        });
        // Reencaminhar telemetria e derivar eventos em tempo real.
        mqtt_service_1.mqttService.onTelemetry((payload) => {
            this.lastTelemetryByDevice.set(payload.system.device_id, payload);
            this.io?.emit("telemetry_update", payload);
            this.handleAlertEvent(payload);
            this.handleTripLifecycle(payload);
        });
    }
    async handleAlertEvent(payload) {
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
            // Persistir evento de risco na BD (etapa 1.12)
            await this.persistTripEvent(payload, status);
        }
        this.lastEventStatusByDevice.set(deviceId, status);
    }
    handleTripLifecycle(payload) {
        const deviceId = payload.system.device_id;
        const speed = payload.telemetry.speed_kmh;
        const tripActive = this.tripActiveByDevice.get(deviceId) ?? false;
        if (!tripActive && speed >= SocketService.TRIP_START_SPEED_KMH) {
            this.startTrip(payload);
            return;
        }
        if (!tripActive) {
            return;
        }
        if (speed <= SocketService.TRIP_END_SPEED_KMH) {
            const stationaryTicks = (this.stationaryTicksByDevice.get(deviceId) ?? 0) + 1;
            this.stationaryTicksByDevice.set(deviceId, stationaryTicks);
            if (stationaryTicks >= SocketService.TRIP_END_STATIONARY_TICKS) {
                this.endTrip(payload);
            }
            return;
        }
        this.stationaryTicksByDevice.set(deviceId, 0);
        this.updateTripStats(deviceId, payload);
    }
    async startTrip(payload) {
        const deviceId = payload.system.device_id;
        const timestamp = payload.system.timestamp;
        try {
            const association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId);
            if (!association) {
                console.warn(`Mota não encontrada para deviceId: ${deviceId}`);
                return;
            }
            const trip = await prisma_service_1.prisma.trip.create({
                data: {
                    userId: association.userId,
                    motorcycleId: association.motorcycleId,
                    source: deviceId.toUpperCase().includes("SIM") ? "SIMULATOR" : "DEVICE_REAL",
                    startedAt: new Date(timestamp),
                    status: "ACTIVE",
                },
            });
            this.activeTripIdByDevice.set(deviceId, trip.id);
            this.tripActiveByDevice.set(deviceId, true);
            this.stationaryTicksByDevice.set(deviceId, 0);
            this.tripStatsByDevice.set(deviceId, {
                maxSpeed: payload.telemetry.speed_kmh,
                maxRoll: Math.abs(payload.imu.roll_deg),
                maxGForce: payload.imu.g_force,
                startLat: payload.location.latitude,
                startLon: payload.location.longitude,
                speedSum: payload.telemetry.speed_kmh,
                speedTicks: 1,
                ticks: 1,
            });
            this.io?.emit("trip_started", {
                deviceId,
                motoModel: payload.system.moto_model,
                timestamp,
                tripId: trip.id,
            });
            console.log(`Viagem iniciada: ${trip.id} (device: ${deviceId}, user: ${association.userId})`);
        }
        catch (error) {
            console.error("Erro ao criar viagem:", error);
        }
    }
    updateTripStats(deviceId, payload) {
        const stats = this.tripStatsByDevice.get(deviceId);
        if (!stats)
            return;
        stats.maxSpeed = Math.max(stats.maxSpeed, payload.telemetry.speed_kmh);
        stats.maxRoll = Math.max(stats.maxRoll, Math.abs(payload.imu.roll_deg));
        stats.maxGForce = Math.max(stats.maxGForce, payload.imu.g_force);
        stats.speedSum += payload.telemetry.speed_kmh;
        stats.speedTicks++;
        stats.ticks++;
        // Flush parcial a cada 30 ticks (~30 segundos)
        if (stats.ticks % 30 === 0) {
            this.flushTripStats(deviceId);
        }
    }
    async flushTripStats(deviceId) {
        const tripId = this.activeTripIdByDevice.get(deviceId);
        const stats = this.tripStatsByDevice.get(deviceId);
        if (!tripId || !stats)
            return;
        try {
            await prisma_service_1.prisma.trip.update({
                where: { id: tripId },
                data: {
                    maxSpeedKmh: stats.maxSpeed,
                    maxRollDeg: stats.maxRoll,
                    maxGForce: stats.maxGForce,
                    avgSpeedKmh: stats.speedTicks > 0 ? stats.speedSum / stats.speedTicks : null,
                },
            });
        }
        catch (error) {
            console.error("Erro ao atualizar estatísticas da viagem:", error);
        }
    }
    async endTrip(payload) {
        const deviceId = payload.system.device_id;
        const timestamp = payload.system.timestamp;
        const tripId = this.activeTripIdByDevice.get(deviceId);
        const stats = this.tripStatsByDevice.get(deviceId);
        this.tripActiveByDevice.set(deviceId, false);
        this.stationaryTicksByDevice.set(deviceId, 0);
        if (!tripId) {
            console.warn(`Nenhuma viagem ativa para deviceId: ${deviceId}`);
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: payload.system.moto_model,
                timestamp,
            });
            return;
        }
        try {
            let distanceKm = 0;
            if (stats) {
                distanceKm = this.haversineDistance(stats.startLat, stats.startLon, payload.location.latitude, payload.location.longitude);
            }
            const avgSpeedKmh = stats && stats.speedTicks > 0
                ? stats.speedSum / stats.speedTicks
                : null;
            await prisma_service_1.prisma.trip.update({
                where: { id: tripId },
                data: {
                    endedAt: new Date(timestamp),
                    status: "COMPLETED",
                    distanceKm,
                    maxSpeedKmh: stats?.maxSpeed ?? 0,
                    maxRollDeg: stats?.maxRoll ?? 0,
                    maxGForce: stats?.maxGForce ?? 0,
                    avgSpeedKmh,
                },
            });
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: payload.system.moto_model,
                timestamp,
                tripId,
                distanceKm,
                maxSpeedKmh: stats?.maxSpeed ?? 0,
            });
            console.log(`Viagem finalizada: ${tripId} (${distanceKm.toFixed(2)} km)`);
            this.activeTripIdByDevice.delete(deviceId);
            this.tripStatsByDevice.delete(deviceId);
        }
        catch (error) {
            console.error("Erro ao finalizar viagem:", error);
            this.io?.emit("trip_ended", { deviceId, motoModel: payload.system.moto_model, timestamp });
        }
    }
    async forceEndTripsOnStopCommand() {
        const activeDevices = Array.from(this.activeTripIdByDevice.keys());
        if (activeDevices.length === 0) {
            return;
        }
        const preferredDeviceId = telemetry_store_1.telemetryStore.latest?.system?.device_id;
        const devicesToEnd = preferredDeviceId && activeDevices.includes(preferredDeviceId)
            ? [preferredDeviceId]
            : activeDevices;
        await Promise.all(devicesToEnd.map((deviceId) => this.forceEndTrip(deviceId)));
    }
    async forceEndTrip(deviceId) {
        const tripId = this.activeTripIdByDevice.get(deviceId);
        const stats = this.tripStatsByDevice.get(deviceId);
        const lastPayload = this.lastTelemetryByDevice.get(deviceId);
        const endedAt = new Date();
        this.tripActiveByDevice.set(deviceId, false);
        this.stationaryTicksByDevice.set(deviceId, 0);
        if (!tripId) {
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: lastPayload?.system.moto_model ?? "—",
                timestamp: endedAt.toISOString(),
            });
            return;
        }
        let distanceKm = 0;
        if (stats && lastPayload) {
            distanceKm = this.haversineDistance(stats.startLat, stats.startLon, lastPayload.location.latitude, lastPayload.location.longitude);
        }
        const avgSpeedKmh = stats && stats.speedTicks > 0 ? stats.speedSum / stats.speedTicks : null;
        try {
            await prisma_service_1.prisma.trip.update({
                where: { id: tripId },
                data: {
                    endedAt,
                    status: "COMPLETED",
                    distanceKm,
                    maxSpeedKmh: stats?.maxSpeed ?? 0,
                    maxRollDeg: stats?.maxRoll ?? 0,
                    maxGForce: stats?.maxGForce ?? 0,
                    avgSpeedKmh,
                },
            });
        }
        catch (error) {
            console.error("Erro ao finalizar viagem (forceEndTrip):", error);
        }
        finally {
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: lastPayload?.system.moto_model ?? "—",
                timestamp: endedAt.toISOString(),
                tripId,
                distanceKm,
                maxSpeedKmh: stats?.maxSpeed ?? 0,
            });
            this.activeTripIdByDevice.delete(deviceId);
            this.tripStatsByDevice.delete(deviceId);
        }
    }
    /** Calcula distância em km entre coordenadas GPS */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(deg) {
        return (deg * Math.PI) / 180;
    }
    normalizeEventStatus(status) {
        const trimmed = status.trim();
        if (!trimmed) {
            return "NORMAL";
        }
        return trimmed.toUpperCase();
    }
    /** Persiste evento de risco na base de dados (etapa 1.12) */
    async persistTripEvent(payload, status) {
        const deviceId = payload.system.device_id;
        const tripId = this.activeTripIdByDevice.get(deviceId);
        if (!tripId) {
            // Só persiste eventos se houver uma viagem ativa
            return;
        }
        // Mapear status para tipo e severidade
        const { eventType, severity, message } = this.mapStatusToEventType(status);
        try {
            await prisma_service_1.prisma.tripEvent.create({
                data: {
                    tripId,
                    type: eventType,
                    severity: severity,
                    message,
                    latitude: payload.location.latitude,
                    longitude: payload.location.longitude,
                    speedKmh: payload.telemetry.speed_kmh,
                    rollDeg: payload.imu.roll_deg,
                    gForce: payload.imu.g_force,
                    engineTempC: payload.telemetry.engine_temp_c,
                    voltage: payload.telemetry.voltage,
                    occurredAt: new Date(payload.system.timestamp),
                },
            });
            console.log(`Evento ${eventType} persistido na viagem ${tripId}`);
        }
        catch (error) {
            console.error("Erro ao persistir evento de risco:", error);
        }
    }
    mapStatusToEventType(status) {
        const statusMap = {
            "CRASH": { type: "CRASH_DETECTED", severity: "CRITICAL", message: "Queda detetada" },
            "QUEDA": { type: "CRASH_DETECTED", severity: "CRITICAL", message: "Queda detetada" },
            "FALL": { type: "CRASH_DETECTED", severity: "CRITICAL", message: "Queda detetada" },
            "OVERHEAT": { type: "OVERHEAT", severity: "WARNING", message: "Sobreaquecimento do motor" },
            "SOBREAQUECIMENTO": { type: "OVERHEAT", severity: "WARNING", message: "Sobreaquecimento do motor" },
            "ALTERNADOR": { type: "LOW_VOLTAGE", severity: "WARNING", message: "Falha no alternador" },
            "LOW_VOLTAGE": { type: "LOW_VOLTAGE", severity: "WARNING", message: "Voltagem baixa" },
            "HARD_BRAKING": { type: "HARD_BRAKING", severity: "INFO", message: "Travagem brusca" },
            "EXCESSIVE_LEAN": { type: "EXCESSIVE_LEAN", severity: "WARNING", message: "Inclinação excessiva" },
            "HIGH_VIBRATION": { type: "HIGH_VIBRATION", severity: "WARNING", message: "Vibração anómala" },
            "RAPID_ACCEL": { type: "RAPID_ACCELERATION", severity: "INFO", message: "Aceleração brusca" },
            "TIRE_PRESSURE": { type: "TIRE_PRESSURE_LOW", severity: "WARNING", message: "Pressão dos pneus baixa" },
            "OIL_PRESSURE": { type: "OIL_PRESSURE_LOW", severity: "CRITICAL", message: "Pressão do óleo baixa" },
        };
        const mapped = statusMap[status.toUpperCase()];
        if (mapped) {
            return { eventType: mapped.type, severity: mapped.severity, message: mapped.message };
        }
        return { eventType: "HIGH_VIBRATION", severity: "INFO", message: `Evento: ${status}` };
    }
}
// Exporta instância singleton
exports.socketService = new SocketService();
//# sourceMappingURL=socket.service.js.map