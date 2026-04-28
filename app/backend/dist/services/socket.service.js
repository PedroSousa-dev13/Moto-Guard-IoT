"use strict";
// =============================================================================
// MotoGuard IoT — Serviço: Socket.IO
// =============================================================================
// Gere as ligações WebSocket com o frontend. Reencaminha telemetria MQTT
// em tempo real, emite eventos de alerta/viagem e recebe comandos.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const mqtt_service_1 = require("./mqtt.service");
const telemetry_store_1 = require("./telemetry.store");
const prisma_service_1 = require("./prisma.service");
const influx_service_1 = require("./influx.service");
const device_association_service_1 = require("./device-association.service");
const heuristics_service_1 = require("./heuristics.service");
const enums_1 = require("../generated/prisma/enums");
const email_service_1 = require("./email.service");
const crypto_1 = require("../utils/crypto");
const env_1 = require("../config/env");
const realtime_anomaly_service_1 = require("./realtime-anomaly.service");
const trip_clustering_service_1 = require("./trip-clustering.service");
class SocketService {
    io = null;
    _connectedClients = 0;
    tripActiveByDevice = new Map();
    stationaryTicksByDevice = new Map();
    lastEventStatusByDevice = new Map();
    pendingEmergenciesByDevice = new Map();
    lastTelemetryByDevice = new Map();
    activeTripIdByDevice = new Map(); // Persistência: tripId atual
    lastStopHandledAtByDevice = new Map();
    lastTripEndedAtByDevice = new Map();
    lastUserIdByDevice = new Map();
    lastMotoModelByDevice = new Map();
    lastSourceByDevice = new Map();
    tripStatsByDevice = new Map();
    heuristicStateByDevice = new Map();
    profileThresholdsCacheByDevice = new Map();
    // Thresholds simples para ciclo de viagem em tempo real.
    static TRIP_START_SPEED_KMH = 5;
    static TRIP_END_SPEED_KMH = 2;
    static TRIP_END_STATIONARY_TICKS = 100;
    /** Emitir evento para todos os clientes ligados */
    emit(event, data) {
        this.io?.emit(event, data);
    }
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
            socket.on("send_command", async (command) => {
                console.log("Comando recebido do frontend:", JSON.stringify(command));
                const sent = mqtt_service_1.mqttService.publishCommand(command);
                if (!sent) {
                    socket.emit("error_msg", { message: "MQTT não está conectado" });
                    return;
                }
                const transportDeviceId = command?.device_id ?? telemetry_store_1.telemetryStore.latest?.system?.device_id;
                const identityDeviceId = command?.new_device_id ?? transportDeviceId;
                const userId = command?.userId ?? null;
                if (identityDeviceId && transportDeviceId && userId && command?.acao === "definir_modelo") {
                    const motoModel = command?.motorcycleName ??
                        command?.modelo ??
                        this.lastMotoModelByDevice.get(identityDeviceId) ??
                        this.lastTelemetryByDevice.get(identityDeviceId)?.system?.moto_model ??
                        telemetry_store_1.telemetryStore.latest?.system?.moto_model ??
                        "Simulador";
                    console.log(`[SocketService] Associando device ${identityDeviceId} (via ${transportDeviceId}) ao user ${userId} (Mota: ${motoModel})`);
                    try {
                        await this.ensureAssociationForDevice(identityDeviceId, userId, motoModel);
                        // Guardar para uso na próxima telemetria (tanto no ID físico como no virtual)
                        this.lastUserIdByDevice.set(transportDeviceId, userId);
                        this.lastUserIdByDevice.set(identityDeviceId, userId);
                        this.lastMotoModelByDevice.set(transportDeviceId, motoModel);
                        this.lastMotoModelByDevice.set(identityDeviceId, motoModel);
                        // Guardar origem explícita se fornecida (SIMULATOR | GPX_IMPORTED | DEVICE_REAL)
                        if (command.source) {
                            this.lastSourceByDevice.set(transportDeviceId, command.source);
                            this.lastSourceByDevice.set(identityDeviceId, command.source);
                        }
                    }
                    catch (error) {
                        console.error("[SocketService] Erro ao associar device ao utilizador:", error);
                    }
                }
                if (command?.acao === "parar") {
                    try {
                        const stopSource = command?.source?.toUpperCase() ?? "";
                        const simulatorStopSources = new Set(["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"]);
                        const lastStatus = transportDeviceId
                            ? this.lastTelemetryByDevice.get(transportDeviceId)?.system?.event_status?.toUpperCase()
                            : null;
                        const now = Date.now();
                        const lastTripEndedAt = transportDeviceId
                            ? this.lastTripEndedAtByDevice.get(transportDeviceId) ?? 0
                            : 0;
                        const recentTripEnded = transportDeviceId ? now - lastTripEndedAt < 3000 : false;
                        const isSimulatorStop = simulatorStopSources.has(stopSource) || lastStatus === "TRIP_ENDED";
                        if (!isSimulatorStop && !recentTripEnded) {
                            await this.forceEndTripsOnStopCommand(transportDeviceId ?? null);
                            this.clearRuntimeStateAfterStop(transportDeviceId ?? null);
                        }
                        else if (transportDeviceId && !(this.tripActiveByDevice.get(transportDeviceId) ?? false) && !recentTripEnded) {
                            this.clearRuntimeStateAfterStop(transportDeviceId);
                        }
                        this.io?.emit("status", telemetry_store_1.telemetryStore.getStatus(mqtt_service_1.mqttService.connected));
                    }
                    catch (error) {
                        console.error("Erro ao forçar fim de viagem:", error);
                    }
                }
            });
            socket.on("telemetry_update", async (payload) => {
                // Processar telemetria vinda do frontend (Simuladores GPX/Real)
                const deviceId = payload.system.device_id;
                this.lastTelemetryByDevice.set(deviceId, payload);
                // Extrair e cachear source do payload (cada pacote GPX/Real agora traz source)
                if (payload.system.source) {
                    this.lastSourceByDevice.set(deviceId, payload.system.source);
                }
                influx_service_1.influxService.writeTelemetry(payload);
                socket.broadcast.emit("telemetry_update", payload);
                this.handleAlertEvent(payload);
                this.handleTripLifecycle(payload);
                await this.handleHeuristicEvents(payload);
            });
            socket.on("cancel_emergency", (data) => {
                this.handleCancelEmergency(socket, data.deviceId);
            });
            socket.on("disconnect", () => {
                this._connectedClients--;
                console.log(`Cliente desconectado (${this._connectedClients} restantes)`);
            });
        });
        // Reencaminhar telemetria e derivar eventos em tempo real.
        mqtt_service_1.mqttService.onTelemetry(async (payload) => {
            this.lastTelemetryByDevice.set(payload.system.device_id, payload);
            influx_service_1.influxService.writeTelemetry(payload);
            this.io?.emit("telemetry_update", payload);
            this.handleAlertEvent(payload);
            this.handleTripLifecycle(payload);
            await this.handleHeuristicEvents(payload);
            // Deteção de anomalias ML em tempo real
            void realtime_anomaly_service_1.realtimeAnomalyService.processTelemetry(payload);
        });
    }
    async getProfileThresholds(deviceId, motoModel) {
        const cached = this.profileThresholdsCacheByDevice.get(deviceId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.thresholds;
        }
        const fallback = {
            maxSpeedKmh: 200,
            typicalMaxRollDeg: 40,
            crashRollThreshold: 70,
            crashGForce: 2.5,
            criticalTemp: 110,
            criticalVoltage: 11.0,
            criticalRpm: 12000,
        };
        try {
            const lastUserId = this.lastUserIdByDevice.get(deviceId);
            const motorcycle = await prisma_service_1.prisma.motorcycle.findFirst({
                where: {
                    deviceId,
                    ...(lastUserId ? { userId: lastUserId } : {})
                },
                include: { profile: true },
            });
            const profile = motorcycle?.profile ??
                (motoModel
                    ? await prisma_service_1.prisma.motorcycleProfile.findFirst({ where: { name: motoModel } })
                    : null);
            if (!profile) {
                this.profileThresholdsCacheByDevice.set(deviceId, {
                    expiresAt: Date.now() + 60_000,
                    thresholds: fallback,
                });
                return fallback;
            }
            const thresholds = {
                maxSpeedKmh: profile.maxSpeedKmh,
                typicalMaxRollDeg: profile.typicalMaxRollDeg,
                crashRollThreshold: profile.crashRollThreshold,
                crashGForce: profile.crashGForce,
                criticalTemp: profile.criticalTemp,
                criticalVoltage: profile.criticalVoltage,
                criticalRpm: profile.criticalRpm ?? profile.rpm_max * 0.9,
            };
            this.profileThresholdsCacheByDevice.set(deviceId, {
                expiresAt: Date.now() + 60_000,
                thresholds,
            });
            return thresholds;
        }
        catch {
            this.profileThresholdsCacheByDevice.set(deviceId, {
                expiresAt: Date.now() + 30_000,
                thresholds: fallback,
            });
            return fallback;
        }
    }
    async handleHeuristicEvents(payload) {
        const deviceId = payload.system.device_id;
        const tripId = this.activeTripIdByDevice.get(deviceId) ?? null;
        if (!tripId) {
            return;
        }
        const state = this.heuristicStateByDevice.get(deviceId) ?? (0, heuristics_service_1.createInitialHeuristicState)();
        this.heuristicStateByDevice.set(deviceId, state);
        const nowMs = Date.now();
        let dtSec = 1;
        const prevTimestamp = state.prevPayload?.system?.timestamp ?? null;
        const currentTimestamp = payload.system.timestamp ?? null;
        if (prevTimestamp && currentTimestamp) {
            const prev = new Date(prevTimestamp).getTime();
            const cur = new Date(currentTimestamp).getTime();
            if (!Number.isNaN(prev) && !Number.isNaN(cur) && cur > prev) {
                dtSec = Math.min(5, Math.max(0.05, (cur - prev) / 1000));
            }
        }
        const thresholds = await this.getProfileThresholds(deviceId, payload.system.moto_model);
        const evaluation = (0, heuristics_service_1.evaluateTelemetryRisk)(payload, state, thresholds, nowMs, dtSec);
        if (evaluation.events.length === 0) {
            return;
        }
        const occurredAtSafe = new Date(payload.system.timestamp);
        const occurredAt = Number.isNaN(occurredAtSafe.getTime()) ? new Date() : occurredAtSafe;
        for (const ev of evaluation.events) {
            try {
                await prisma_service_1.prisma.tripEvent.create({
                    data: {
                        tripId,
                        type: ev.type,
                        severity: ev.severity,
                        message: ev.message,
                        latitude: payload.location.latitude,
                        longitude: payload.location.longitude,
                        speedKmh: payload.telemetry.speed_kmh,
                        rollDeg: payload.imu.roll_deg,
                        gForce: payload.imu.g_force,
                        engineTempC: payload.telemetry.engine_temp_c,
                        voltage: payload.telemetry.voltage,
                        occurredAt,
                    },
                });
                if (ev.type === enums_1.EventType.CRASH_DETECTED) {
                    void this.sendEmergencyEmail(tripId, payload);
                }
                // Emitir alerta para o frontend em tempo real
                this.io?.emit("alert", {
                    status: ev.type,
                    severity: ev.severity,
                    message: ev.message,
                    deviceId,
                    motoModel: payload.system.moto_model,
                    timestamp: occurredAt.toISOString(),
                    tripId,
                });
            }
            catch (error) {
                console.error("Erro ao persistir evento heurístico:", error);
            }
        }
    }
    async handleAlertEvent(payload) {
        const deviceId = payload.system.device_id;
        const status = this.normalizeEventStatus(payload.system.event_status);
        const previousStatus = this.lastEventStatusByDevice.get(deviceId) ?? "NORMAL";
        if (status !== "NORMAL") {
            console.log(`[SocketService] Status detetado em ${deviceId}: "${status}" (Anterior: "${previousStatus}")`);
        }
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
        const status = payload.system.event_status?.toUpperCase();
        const tripActive = this.tripActiveByDevice.get(deviceId) ?? false;
        // Se o payload indicar explicitamente que a viagem terminou, encerramos já.
        if (tripActive && status === "TRIP_ENDED") {
            console.log(`[SocketService] Fim de viagem forçado por status "TRIP_ENDED" em ${deviceId}`);
            this.endTrip(payload);
            return;
        }
        if (!tripActive && (speed >= SocketService.TRIP_START_SPEED_KMH || status === "TRIP_STARTED")) {
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
                console.log(`[SocketService] Fim de viagem automático (stationary) em ${deviceId} (${stationaryTicks} ticks)`);
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
        // Verificar se já existe uma viagem ativa para este dispositivo
        const existingTripId = this.activeTripIdByDevice.get(deviceId);
        if (existingTripId) {
            console.log(`[SocketService] Viagem já ativa para ${deviceId}: ${existingTripId} — ignorando novo início`);
            return;
        }
        try {
            // Priorizar o último utilizador que interagiu com este dispositivo (essencial para o simulador partilhado)
            const lastUserId = this.lastUserIdByDevice.get(deviceId);
            const motoModel = payload.system.moto_model;
            console.log(`[SocketService] Tentando iniciar viagem para ${deviceId} (User em cache: ${lastUserId}, Modelo: ${motoModel})`);
            const association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, lastUserId, motoModel);
            if (!association) {
                console.warn(`[SocketService] Mota não encontrada para deviceId: ${deviceId} (User: ${lastUserId}, Model: ${motoModel}). Viagem ignorada.`);
                return;
            }
            // Verificar na BD se há viagem ativa (segurança extra)
            const dbActiveTrip = await prisma_service_1.prisma.trip.findFirst({
                where: {
                    motorcycleId: association.motorcycleId,
                    status: "ACTIVE",
                },
            });
            if (dbActiveTrip) {
                console.log(`[SocketService] Viagem ativa na BD para ${deviceId}: ${dbActiveTrip.id} — retomando`);
                this.activeTripIdByDevice.set(deviceId, dbActiveTrip.id);
                this.tripActiveByDevice.set(deviceId, true);
                this.stationaryTicksByDevice.set(deviceId, 0);
                return;
            }
            const tripSource = this.resolveSourceForDevice(deviceId);
            const trip = await prisma_service_1.prisma.trip.create({
                data: {
                    userId: association.userId,
                    motorcycleId: association.motorcycleId,
                    source: tripSource,
                    startedAt: new Date(timestamp),
                    status: "ACTIVE",
                    // Inicializar com 0 para evitar nulls no frontend
                    distanceKm: 0,
                    maxSpeedKmh: 0,
                    avgSpeedKmh: 0,
                    maxRollDeg: 0,
                    maxGForce: 0,
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
                startOdometer: payload.telemetry.odometer_km ?? 0,
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
        // Flush parcial a cada 300 ticks (~30 segundos reais a 10Hz)
        if (stats.ticks % 300 === 0) {
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
        // Quando a viagem acaba automaticamente, enviamos o comando "parar" 
        // para o simulador, tal como se o utilizador tivesse carregado no botão.
        mqtt_service_1.mqttService.publishCommand({
            acao: "parar",
            device_id: deviceId
        });
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
            // Forçar um flush final das estatísticas
            await this.flushTripStats(deviceId);
            let distanceKm = 0;
            if (stats) {
                const currentOdometer = payload.telemetry.odometer_km ?? 0;
                if (currentOdometer > 0 && stats.startOdometer > 0) {
                    distanceKm = currentOdometer - stats.startOdometer;
                }
                else {
                    // Fallback para Haversine se o odómetro falhar
                    distanceKm = this.haversineDistance(stats.startLat, stats.startLon, payload.location.latitude, payload.location.longitude);
                }
            }
            const avgSpeedKmh = stats && stats.speedTicks > 0
                ? stats.speedSum / stats.speedTicks
                : null;
            const trip = await prisma_service_1.prisma.trip.findUnique({
                where: { id: tripId },
                select: { userId: true }
            });
            // Se todos os stats são zeros, manter a viagem mas marcar como CANCELLED
            const allZeros = (distanceKm === 0 || distanceKm === null) &&
                (stats?.maxSpeed ?? 0) === 0 &&
                (stats?.maxRoll ?? 0) === 0 &&
                (stats?.maxGForce ?? 0) === 0;
            if (allZeros) {
                await prisma_service_1.prisma.trip.update({
                    where: { id: tripId },
                    data: {
                        endedAt: new Date(timestamp),
                        status: "CANCELLED",
                        distanceKm,
                        maxSpeedKmh: stats?.maxSpeed ?? 0,
                        maxRollDeg: stats?.maxRoll ?? 0,
                        maxGForce: stats?.maxGForce ?? 0,
                        avgSpeedKmh,
                    },
                });
                console.log(`Viagem cancelada (dados insuficientes): ${tripId}`);
                this.io?.emit("trip_ended", {
                    deviceId,
                    motoModel: payload.system.moto_model,
                    timestamp,
                    tripId,
                    status: "CANCELLED",
                    error: "Viagem sem dados suficientes para registo"
                });
                this.lastTripEndedAtByDevice.set(deviceId, Date.now());
            }
            else {
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
                console.log(`Viagem finalizada com sucesso: ${tripId} (${distanceKm.toFixed(2)} km)`);
                // Iniciar clustering para atualizar estilo de condução
                if (trip?.userId) {
                    void trip_clustering_service_1.tripClusteringService.clusterUserTrips(trip.userId);
                }
                this.io?.emit("trip_ended", {
                    deviceId,
                    motoModel: payload.system.moto_model,
                    timestamp,
                    tripId,
                    distanceKm,
                    maxSpeedKmh: stats?.maxSpeed ?? 0,
                    status: "COMPLETED"
                });
                this.lastTripEndedAtByDevice.set(deviceId, Date.now());
            }
            this.activeTripIdByDevice.delete(deviceId);
            this.tripStatsByDevice.delete(deviceId);
        }
        catch (error) {
            console.error("Erro ao finalizar viagem:", error);
            // Notificamos o frontend de que "tentámos" terminar, mas o status na BD pode estar inconsistente.
            // No entanto, é melhor não emitir nada ou emitir um erro.
            // Aqui vamos emitir um sinal genérico para que o dashboard resete a vista.
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: payload.system.moto_model,
                timestamp,
                error: "Falha ao persistir fim da viagem no servidor"
            });
        }
    }
    async forceEndTripsOnStopCommand(deviceId) {
        const activeDevices = Array.from(this.activeTripIdByDevice.keys());
        const preferredDeviceId = deviceId ?? telemetry_store_1.telemetryStore.latest?.system?.device_id ?? null;
        if (activeDevices.length === 0) {
            const fallbackDeviceId = preferredDeviceId ??
                Array.from(this.lastTelemetryByDevice.keys()).slice(-1)[0] ??
                null;
            if (!fallbackDeviceId)
                return;
            await this.forceEndTrip(fallbackDeviceId);
            return;
        }
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
            const now = endedAt.getTime();
            const lastHandledAt = this.lastStopHandledAtByDevice.get(deviceId) ?? 0;
            if (now - lastHandledAt < 1500) {
                return;
            }
            this.lastStopHandledAtByDevice.set(deviceId, now);
            // Check if there's a recently ended trip for this device (within last 30s)
            const recentTrip = await prisma_service_1.prisma.trip.findFirst({
                where: {
                    motorcycle: { deviceId },
                    status: "COMPLETED",
                    endedAt: { gte: new Date(endedAt.getTime() - 30000) },
                },
                orderBy: { endedAt: "desc" },
            });
            if (recentTrip) {
                console.log(`Viagem já finalizada recentemente: ${recentTrip.id}`);
                this.io?.emit("trip_ended", {
                    deviceId,
                    motoModel: lastPayload?.system.moto_model ?? this.lastMotoModelByDevice.get(deviceId) ?? "—",
                    timestamp: endedAt.toISOString(),
                    tripId: recentTrip.id,
                    distanceKm: recentTrip.distanceKm,
                    maxSpeedKmh: recentTrip.maxSpeedKmh,
                    status: "COMPLETED"
                });
                return;
            }
            const created = lastPayload
                ? await this.createCompletedTripFromLastPayload(deviceId, endedAt)
                : await this.createCompletedTripWithoutTelemetry(deviceId, endedAt);
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: lastPayload?.system.moto_model ?? this.lastMotoModelByDevice.get(deviceId) ?? "—",
                timestamp: endedAt.toISOString(),
                tripId: created?.tripId,
                distanceKm: created?.distanceKm,
                maxSpeedKmh: created?.maxSpeedKmh,
            });
            this.lastTripEndedAtByDevice.set(deviceId, Date.now());
            return;
        }
        let distanceKm = 0;
        if (stats && lastPayload) {
            const currentOdometer = lastPayload.telemetry.odometer_km ?? 0;
            if (currentOdometer > 0 && stats.startOdometer > 0) {
                distanceKm = currentOdometer - stats.startOdometer;
            }
            else {
                distanceKm = this.haversineDistance(stats.startLat, stats.startLon, lastPayload.location.latitude, lastPayload.location.longitude);
            }
        }
        const avgSpeedKmh = stats && stats.speedTicks > 0 ? stats.speedSum / stats.speedTicks : null;
        try {
            // Se todos os stats são zeros, manter a viagem mas marcar como CANCELLED
            const allZeros = (distanceKm === 0 || distanceKm === null) &&
                (stats?.maxSpeed ?? 0) === 0 &&
                (stats?.maxRoll ?? 0) === 0 &&
                (stats?.maxGForce ?? 0) === 0;
            if (allZeros) {
                await prisma_service_1.prisma.trip.update({
                    where: { id: tripId },
                    data: {
                        endedAt,
                        status: "CANCELLED",
                        distanceKm,
                        maxSpeedKmh: stats?.maxSpeed ?? 0,
                        maxRollDeg: stats?.maxRoll ?? 0,
                        maxGForce: stats?.maxGForce ?? 0,
                        avgSpeedKmh,
                    },
                });
                console.log(`[SocketService] Viagem cancelada (dados insuficientes): ${tripId}`);
                this.io?.emit("trip_ended", {
                    deviceId,
                    motoModel: lastPayload?.system.moto_model ?? "—",
                    timestamp: endedAt.toISOString(),
                    tripId,
                    status: "CANCELLED",
                    error: "Viagem sem dados suficientes para registo"
                });
                this.lastTripEndedAtByDevice.set(deviceId, Date.now());
            }
            else {
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
                console.log(`Viagem finalizada com sucesso (forceEndTrip): ${tripId}`);
                this.io?.emit("trip_ended", {
                    deviceId,
                    motoModel: lastPayload?.system.moto_model ?? "—",
                    timestamp: endedAt.toISOString(),
                    tripId,
                    distanceKm,
                    maxSpeedKmh: stats?.maxSpeed ?? 0,
                    status: "COMPLETED"
                });
                this.lastTripEndedAtByDevice.set(deviceId, Date.now());
            }
        }
        catch (error) {
            console.error("Erro ao finalizar viagem (forceEndTrip):", error);
            this.io?.emit("trip_ended", {
                deviceId,
                motoModel: lastPayload?.system.moto_model ?? "—",
                timestamp: endedAt.toISOString(),
                error: "Falha ao forçar fim de viagem"
            });
        }
        finally {
            this.activeTripIdByDevice.delete(deviceId);
            this.tripStatsByDevice.delete(deviceId);
        }
    }
    clearRuntimeStateAfterStop(deviceId) {
        if (deviceId) {
            this.clearDeviceRuntimeState(deviceId);
            telemetry_store_1.telemetryStore.clearLatestIfDevice(deviceId);
            return;
        }
        const knownDevices = new Set([
            ...this.tripActiveByDevice.keys(),
            ...this.stationaryTicksByDevice.keys(),
            ...this.lastEventStatusByDevice.keys(),
            ...this.lastTelemetryByDevice.keys(),
            ...this.activeTripIdByDevice.keys(),
            ...this.tripStatsByDevice.keys(),
            ...this.lastStopHandledAtByDevice.keys(),
            ...this.lastUserIdByDevice.keys(),
            ...this.lastMotoModelByDevice.keys(),
        ]);
        if (knownDevices.size === 0) {
            telemetry_store_1.telemetryStore.clearLatest();
            return;
        }
        for (const knownDeviceId of knownDevices) {
            this.clearDeviceRuntimeState(knownDeviceId);
            telemetry_store_1.telemetryStore.clearLatestIfDevice(knownDeviceId);
        }
    }
    clearDeviceRuntimeState(deviceId) {
        this.tripActiveByDevice.delete(deviceId);
        this.stationaryTicksByDevice.delete(deviceId);
        this.lastEventStatusByDevice.delete(deviceId);
        this.lastTelemetryByDevice.delete(deviceId);
        this.activeTripIdByDevice.delete(deviceId);
        this.tripStatsByDevice.delete(deviceId);
        this.lastStopHandledAtByDevice.delete(deviceId);
    }
    async createCompletedTripFromLastPayload(deviceId, endedAt) {
        const lastPayload = this.lastTelemetryByDevice.get(deviceId);
        if (!lastPayload)
            return null;
        const userId = this.lastUserIdByDevice.get(deviceId) || undefined;
        const motoModel = lastPayload.system.moto_model;
        let association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, userId, motoModel);
        if (!association && userId) {
            await device_association_service_1.deviceAssociationService.registerDevice(deviceId, userId, lastPayload.system.moto_model || `Simulador ${deviceId}`);
            association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, userId);
        }
        if (!association)
            return null;
        const rawStartedAt = new Date(lastPayload.system.timestamp);
        const startedAtSafe = Number.isNaN(rawStartedAt.getTime()) ? endedAt : rawStartedAt;
        const startedAt = startedAtSafe.getTime() > endedAt.getTime() ? endedAt : startedAtSafe;
        const maxSpeedKmh = lastPayload.telemetry.speed_kmh ?? 0;
        const maxRollDeg = Math.abs(lastPayload.imu.roll_deg ?? 0);
        const maxGForce = lastPayload.imu.g_force ?? 0;
        const distanceKm = 0;
        const trip = await prisma_service_1.prisma.trip.create({
            data: {
                userId: association.userId,
                motorcycleId: association.motorcycleId,
                source: this.resolveSourceForDevice(deviceId),
                startedAt,
                endedAt,
                status: "COMPLETED",
                distanceKm,
                maxSpeedKmh,
                maxRollDeg,
                maxGForce,
                avgSpeedKmh: maxSpeedKmh,
            },
        });
        return { tripId: trip.id, distanceKm, maxSpeedKmh };
    }
    async createCompletedTripWithoutTelemetry(deviceId, endedAt) {
        const userId = this.lastUserIdByDevice.get(deviceId) || undefined;
        const motoModel = this.lastMotoModelByDevice.get(deviceId);
        let association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, userId, motoModel || undefined);
        if (!association && userId) {
            await device_association_service_1.deviceAssociationService.registerDevice(deviceId, userId, this.lastMotoModelByDevice.get(deviceId) ?? `Simulador ${deviceId}`);
            association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, userId);
        }
        if (!association)
            return null;
        const distanceKm = 0;
        const maxSpeedKmh = 0;
        const trip = await prisma_service_1.prisma.trip.create({
            data: {
                userId: association.userId,
                motorcycleId: association.motorcycleId,
                source: this.resolveSourceForDevice(deviceId),
                startedAt: endedAt,
                endedAt,
                status: "COMPLETED",
                distanceKm,
                maxSpeedKmh,
                maxRollDeg: 0,
                maxGForce: 0,
                avgSpeedKmh: 0,
            },
        });
        return { tripId: trip.id, distanceKm, maxSpeedKmh };
    }
    async ensureAssociationForDevice(deviceId, userId, motoModel) {
        this.lastUserIdByDevice.set(deviceId, userId);
        this.lastMotoModelByDevice.set(deviceId, motoModel);
        // Verificar se ESTE utilizador já tem associação com este device e modelo
        const association = await device_association_service_1.deviceAssociationService.getAssociation(deviceId, userId, motoModel);
        // Se a associação encontrada pertence a outro utilizador, ou não existe, registamos/criamos uma nova para este utilizador
        if (association && association.userId === userId)
            return;
        await device_association_service_1.deviceAssociationService.registerDevice(deviceId, userId, motoModel || `Simulador ${deviceId}`);
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
        const trimmed = (status || "").trim();
        if (!trimmed)
            return "NORMAL";
        return trimmed.toUpperCase();
    }
    getEventTypeFromStatus(status) {
        const s = status.toUpperCase();
        if (s.includes("CRASH") || s.includes("QUEDA") || s.includes("FALL"))
            return "CRASH_DETECTED";
        if (s.includes("OVERHEAT") || s.includes("SOBREAQUECIMENTO"))
            return "OVERHEAT";
        if (s.includes("ALTERNADOR") || s.includes("LOW_VOLTAGE") || s.includes("VOLTAGEM"))
            return "LOW_VOLTAGE";
        if (s.includes("BRAKING") || s.includes("TRAVAGEM"))
            return "HARD_BRAKING";
        if (s.includes("LEAN") || s.includes("INCLINAÇÃO"))
            return "EXCESSIVE_LEAN";
        if (s.includes("VIBRATION") || s.includes("VIBRAÇÃO"))
            return "HIGH_VIBRATION";
        if (s.includes("ACCEL") || s.includes("ACELERAÇÃO"))
            return "RAPID_ACCELERATION";
        if (s.includes("TIRE") || s.includes("PNEU"))
            return "TIRE_PRESSURE_LOW";
        if (s.includes("OIL") || s.includes("ÓLEO"))
            return "OIL_PRESSURE_LOW";
        return "HIGH_VIBRATION";
    }
    /** Persiste evento de risco na base de dados (etapa 1.12) */
    async persistTripEvent(payload, status) {
        const deviceId = payload.system.device_id;
        let tripId = this.activeTripIdByDevice.get(deviceId);
        // Mapear status para tipo e severidade
        const { eventType, severity, message } = this.mapStatusToEventType(status);
        if (!tripId) {
            if (eventType === "CRASH_DETECTED") {
                console.log(`[SocketService] Queda detetada sem viagem ativa. Iniciando viagem de emergência para ${deviceId}...`);
                await this.startTrip(payload);
                tripId = this.activeTripIdByDevice.get(deviceId);
            }
            else {
                console.warn(`[SocketService] Alerta "${status}" ignorado em ${deviceId} porque não há viagem ativa.`);
                return;
            }
        }
        if (!tripId)
            return;
        console.log(`[SocketService] Persistindo evento "${status}" (${eventType}) para viagem ${tripId}`);
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
            if (eventType === "CRASH_DETECTED") {
                void this.sendEmergencyEmail(tripId, payload);
            }
        }
        catch (error) {
            console.error("Erro ao persistir evento de risco:", error);
        }
    }
    async sendEmergencyEmail(tripId, payload) {
        const deviceId = payload.system.device_id;
        // Se já houver um alerta pendente para este dispositivo, ignorar (evitar spam)
        if (this.pendingEmergenciesByDevice.has(deviceId))
            return;
        console.log(`[SocketService] Queda detetada em ${deviceId}. Iniciando SOS Countdown (20s).`);
        // Notificar frontend para mostrar o contador
        this.io?.emit("crash_detected", {
            deviceId,
            countdownSec: 20,
            timestamp: payload.system.timestamp
        });
        const timeout = setTimeout(async () => {
            try {
                const trip = await prisma_service_1.prisma.trip.findUnique({
                    where: { id: tripId },
                    include: { user: true }
                });
                if (trip?.user?.emergencyContact) {
                    console.log(`[SocketService] SOS Countdown terminado. Disparando email para ${trip.user.emergencyContact}`);
                    let decryptedApiKey = null;
                    if (trip.user.resendApiKey) {
                        try {
                            decryptedApiKey = (0, crypto_1.decrypt)(trip.user.resendApiKey, env_1.env.JWT_SECRET);
                        }
                        catch (err) {
                            console.error("[SocketService] Erro ao desencriptar Resend API Key:", err);
                        }
                    }
                    await (0, email_service_1.sendCrashAlert)({
                        toEmail: trip.user.emergencyContact,
                        riderName: trip.user.name,
                        timestamp: payload.system.timestamp,
                        latitude: payload.location.latitude,
                        longitude: payload.location.longitude,
                        tripId: trip.id,
                        deviceId: payload.system.device_id,
                        resendApiKey: decryptedApiKey,
                    });
                }
            }
            catch (error) {
                console.error("[SocketService] Erro no fluxo de email de emergência:", error);
            }
            finally {
                this.pendingEmergenciesByDevice.delete(deviceId);
            }
        }, 20000); // 20 segundos de countdown
        this.pendingEmergenciesByDevice.set(deviceId, timeout);
    }
    handleCancelEmergency(socket, deviceId) {
        const timeout = this.pendingEmergenciesByDevice.get(deviceId);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingEmergenciesByDevice.delete(deviceId);
            console.log(`[SocketService] Emergência CANCELADA pelo utilizador para o dispositivo ${deviceId}`);
            // Notificar todos os clientes que foi cancelado (para fechar o popup em outros ecrãs se abertos)
            this.io?.emit("emergency_cancelled", { deviceId });
        }
    }
    mapStatusToEventType(status) {
        const eventType = this.getEventTypeFromStatus(status);
        const severityMap = {
            "CRASH_DETECTED": "CRITICAL",
            "OIL_PRESSURE_LOW": "CRITICAL",
            "OVERHEAT": "WARNING",
            "LOW_VOLTAGE": "WARNING",
            "EXCESSIVE_LEAN": "WARNING",
            "HIGH_VIBRATION": "WARNING",
            "TIRE_PRESSURE_LOW": "WARNING",
            "HARD_BRAKING": "INFO",
            "RAPID_ACCELERATION": "INFO",
        };
        const messageMap = {
            "CRASH_DETECTED": "Queda detetada",
            "OVERHEAT": "Sobreaquecimento do motor",
            "LOW_VOLTAGE": "Voltagem baixa / Alerta de bateria",
            "HARD_BRAKING": "Travagem brusca detetada",
            "EXCESSIVE_LEAN": "Inclinação excessiva detetada",
            "HIGH_VIBRATION": "Vibração anómala detetada",
            "RAPID_ACCELERATION": "Aceleração brusca detetada",
            "TIRE_PRESSURE_LOW": "Pressão de pneus baixa",
            "OIL_PRESSURE_LOW": "Pressão de óleo crítica",
        };
        return {
            eventType,
            severity: severityMap[eventType] || "INFO",
            message: messageMap[eventType] || `Evento: ${status}`
        };
    }
    /**
     * Resolves the trip source for a device using a deterministic chain:
     * 1. Explicit source cached from frontend command (definir_modelo) or telemetry payload
     * 2. Device ID prefix pattern matching (MOTOGUARD-GPX-* / MOTOGUARD-IRL-* / MOTOGUARD-SIM-*)
     * 3. Final fallback: SIMULATOR
     */
    resolveSourceForDevice(deviceId) {
        // 1. Check explicit source from frontend commands or telemetry payloads
        const explicit = this.lastSourceByDevice.get(deviceId);
        if (explicit === "GPX_IMPORTED" || explicit === "DEVICE_REAL" || explicit === "SIMULATOR") {
            return explicit;
        }
        // 2. Resolve from device ID prefix pattern
        const id = deviceId.toUpperCase();
        if (id.startsWith("MOTOGUARD-GPX") || id.includes("-GPX-") || id.includes("GPX")) {
            return "GPX_IMPORTED";
        }
        if (id.startsWith("MOTOGUARD-IRL") || id.includes("-IRL-") || id.includes("IRL")) {
            return "DEVICE_REAL";
        }
        // 3. Final fallback: SIMULATOR (headless simulator, MOTOGUARD-SIM-*, etc.)
        return "SIMULATOR";
    }
}
exports.SocketService = SocketService;
// Exporta instância singleton
exports.socketService = new SocketService();
//# sourceMappingURL=socket.service.js.map