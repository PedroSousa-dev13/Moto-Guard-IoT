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
import { prisma } from "./prisma.service";
import { influxService } from "./influx.service";
import { deviceAssociationService } from "./device-association.service";
import type {
  TelemetryPayload,
  SimulatorCommand,
} from "../models/telemetry.model";
import {
  createInitialHeuristicState,
  evaluateTelemetryRisk,
  type HeuristicState,
  type MotorcycleProfileThresholds,
} from "./heuristics.service";
import { EventType } from "../generated/prisma/enums";
import { sendCrashAlert } from "./email.service";
import { decrypt } from "../utils/crypto";
import { env } from "../config/env";
import jwt from "jsonwebtoken";
import { realtimeAnomalyService } from "./realtime-anomaly.service";
import { tripClusteringService } from "./trip-clustering.service";

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

interface TripStats {
  maxSpeed: number;
  maxRoll: number;
  maxGForce: number;
  startLat: number;
  startLon: number;
  prevLat: number;
  prevLon: number;
  accumulatedDistance: number;
  speedSum: number;
  speedTicks: number;
  startOdometer: number;
  ticks: number;
}

export class SocketService {
  private io: Server | null = null;
  private _connectedClients = 0;
  private tripActiveByDevice = new Map<string, boolean>();
  private lastTripEndedEmitByDevice = new Map<string, number>(); // debounce de trip_ended
  private stationaryTicksByDevice = new Map<string, number>();
  private lastEventStatusByDevice = new Map<string, string>();
  private pendingEmergenciesByDevice = new Map<string, NodeJS.Timeout>();
  private lastTelemetryByDevice = new Map<string, TelemetryPayload>();
  private activeTripIdByDevice = new Map<string, string>(); // Persistência: tripId atual
  private lastStopHandledAtByDevice = new Map<string, number>();
  private lastTripEndedAtByDevice = new Map<string, number>();
  // Timestamps de paragens recentes — usados para evitar que pacotes
  // de telemetria "fantasma" (em trânsito no MQTT) recriem uma viagem
  // depois do utilizador carregar em "Parar".
  private recentStopByDevice = new Map<string, number>();
  private lastUserIdByDevice = new Map<string, string>();
  private lastMotoModelByDevice = new Map<string, string>();
  private lastSourceByDevice = new Map<string, string>();
  private tripStatsByDevice = new Map<string, TripStats>();
  private heuristicStateByDevice = new Map<string, HeuristicState>();
  private profileThresholdsCacheByDevice = new Map<string, { expiresAt: number; thresholds: MotorcycleProfileThresholds }>();

  // Thresholds configuráveis via env.ts

  /** Emitir evento para todos os clientes ligados */
  emit(event: string, data: unknown): void {
    this.io?.emit(event, data);
  }

  /** Número de clientes WebSocket ligados */
  get connectedClients(): number {
    return this._connectedClients;
  }

  /** Inicializa o Socket.IO com o servidor HTTP */
  init(httpServer: http.Server): void {
    this.io = new Server(httpServer, {
      cors: { origin: env.NODE_ENV === 'production' ? env.APP_URL : ['http://localhost:5173', 'http://localhost:3000'], methods: ["GET", "POST"] },
    });

    // Registrar callback para anomalias ML (quebra dependência circular)
    realtimeAnomalyService.onAnomaly = (event) => {
      this.io?.emit("realtime_anomaly", event);
    };

    // Autenticação JWT para WebSocket
    this.io.use((socket, next) => {
      function extractWsToken(): string | null {
        // 1. Auth handshake explícito
        if (socket.handshake.auth?.token) return socket.handshake.auth.token as string;
        // 2. Authorization header
        const authHeader = socket.handshake.headers?.authorization;
        if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
          return authHeader.slice(7);
        }
        // 3. Cookie httpOnly (token JWT)
        const cookieHeader = socket.handshake.headers?.cookie;
        if (cookieHeader && typeof cookieHeader === "string") {
          const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
          if (match) return match[1];
        }
        return null;
      }

      const token = extractWsToken();

      if (!token) {
        return next(new Error("Autenticação necessária"));
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        (socket as import("socket.io").Socket & { userId: string }).userId = decoded.sub;
        next();
      } catch {
        next(new Error("Token inválido ou expirado"));
      }
    });

    this.io.on("connection", (socket: Socket) => {
      this._connectedClients++;
      console.log(`Cliente WebSocket conectado (${this._connectedClients} total)`);

      socket.emit("status", telemetryStore.getStatus(mqttService.connected));

      if (telemetryStore.latest) {
        socket.emit("telemetry_update", telemetryStore.latest);
      }

      socket.on("send_command", async (command: SimulatorCommand) => {
        console.log("Comando recebido do frontend:", JSON.stringify(command));

        const normalizedAction = command?.acao?.toLowerCase() ?? "";
        const transportDeviceId = command?.device_id ?? telemetryStore.latest?.system?.device_id;
        const isStopAction = ["parar", "stop_trip", "stop-trip", "trip_end", "trip-ended"].includes(normalizedAction);

        // ── Guard anti-repetição para "parar" ───────────────────────────
        // Se o dispositivo foi parado nos últimos 8 segundos, ignoramos
        // COMPLETAMENTE (nem sequer publicamos ao MQTT) para evitar
        // loops: frontend → backend → MQTT → simulador → backend → …
        if (isStopAction && transportDeviceId) {
          const recentStop = this.recentStopByDevice.get(transportDeviceId);
          if (recentStop !== undefined && Date.now() - recentStop < 8000) {
            console.log(`[SocketService] Stop duplicado ignorado para ${transportDeviceId} (${Date.now() - recentStop}ms desde último stop)`);
            return;
          }
          // Registar ANTES de publicar para bloquear imediatamente duplicados
          this.recentStopByDevice.set(transportDeviceId, Date.now());
          setTimeout(() => {
            this.recentStopByDevice.delete(transportDeviceId);
          }, 10000);
        }

        const sent = mqttService.publishCommand(command);
        if (!sent) {
          socket.emit("error_msg", { message: "MQTT não está conectado" });
          return;
        }
        const identityDeviceId = command?.new_device_id ?? transportDeviceId;
        const userId = command?.userId ?? null;

        if (identityDeviceId && transportDeviceId && userId && command?.acao === "definir_modelo") {
          const motoModel =
            command?.motorcycleName ??
            command?.modelo ??
            this.lastMotoModelByDevice.get(identityDeviceId) ??
            this.lastTelemetryByDevice.get(identityDeviceId)?.system?.moto_model ??
            telemetryStore.latest?.system?.moto_model ??
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
          } catch (error) {
            console.error("[SocketService] Erro ao associar device ao utilizador:", error);
          }
        }

        if (isStopAction) {
          try {
            // ── Lógica de finalização de viagem ────────────────────────────
            // Determinar a fonte do stop para decidir a estratégia.
            const stopSource = command?.source?.toUpperCase()
              ?? (transportDeviceId ? this.lastSourceByDevice.get(transportDeviceId)?.toUpperCase() : undefined)
              ?? "";
            const simulatorStopSources = new Set(["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"]);
            const isSimulatorSource = simulatorStopSources.has(stopSource);
            const now = Date.now();
            const lastTripEndedAt = transportDeviceId
              ? this.lastTripEndedAtByDevice.get(transportDeviceId) ?? 0
              : 0;
            const recentTripEnded = transportDeviceId ? now - lastTripEndedAt < 5000 : false;

            // Para fontes simulador (SIMULATOR, GPX_IMPORTED, DEVICE_REAL):
            // O handleTripLifecycle() já trata de finalizar a viagem quando
            // recebe TRIP_ENDED via telemetria. Aqui apenas limpamos o estado
            // runtime. Se a viagem ainda está ativa (race condition), forçamos
            // o fim.
            if (isSimulatorSource) {
              if (transportDeviceId) {
                const tripStillActive = this.tripActiveByDevice.get(transportDeviceId) ?? false;
                if (tripStillActive && !recentTripEnded) {
                  // Race condition: o TRIP_ENDED da telemetria ainda não chegou
                  // mas o user já carregou em Stop. Forçar fim da viagem.
                  await this.forceEndTripsOnStopCommand(transportDeviceId);
                }
                this.clearRuntimeStateAfterStop(transportDeviceId);
              }
            } else if (!recentTripEnded) {
              // Fonte não-simulador (ex: dispositivo real sem TRIP_ENDED)
              await this.forceEndTripsOnStopCommand(transportDeviceId ?? null);
              this.clearRuntimeStateAfterStop(transportDeviceId ?? null);
            } else if (transportDeviceId) {
              // Recente trip ended — apenas limpar estado
              this.clearRuntimeStateAfterStop(transportDeviceId);
            }

            this.io?.emit("status", telemetryStore.getStatus(mqttService.connected));
          } catch (error) {
            console.error("Erro ao forçar fim de viagem:", error);
          }
        }
      });

      socket.on("telemetry_update", async (payload: TelemetryPayload) => {
        // Processar telemetria vinda do frontend (Simuladores GPX/Real)
        const deviceId = payload.system.device_id;
        this.lastTelemetryByDevice.set(deviceId, payload);
        
        // Extrair e cachear source do payload (cada pacote GPX/Real agora traz source)
        if (payload.system.source) {
          this.lastSourceByDevice.set(deviceId, payload.system.source);
        }
        
        influxService.writeTelemetry(payload);
        socket.broadcast.emit("telemetry_update", payload);
        
        this.handleAlertEvent(payload);
        this.handleTripLifecycle(payload);
        await this.handleHeuristicEvents(payload);
      });

      socket.on("cancel_emergency", (data: { deviceId: string }) => {
        this.handleCancelEmergency(socket, data.deviceId);
      });

      socket.on("disconnect", () => {
        this._connectedClients--;
        console.log(`Cliente desconectado (${this._connectedClients} restantes)`);
      });
    });

    // Reencaminhar telemetria e derivar eventos em tempo real.
    mqttService.onTelemetry(async (payload: TelemetryPayload) => {
      this.lastTelemetryByDevice.set(payload.system.device_id, payload);
      influxService.writeTelemetry(payload);
      this.io?.emit("telemetry_update", payload);
      this.handleAlertEvent(payload);
      this.handleTripLifecycle(payload);
      await this.handleHeuristicEvents(payload);
      
      // Deteção de anomalias ML em tempo real
      realtimeAnomalyService.processTelemetry(payload).catch((err) => {
        console.error("[realtime-anomaly] Erro ao processar telemetria:", err);
      });
    });
  }

  /** Fecha o servidor Socket.IO. Chamado no shutdown graceful. */
  stop(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this._connectedClients = 0;
    }
  }

  private async getProfileThresholds(deviceId: string, motoModel: string): Promise<MotorcycleProfileThresholds> {
    const cached = this.profileThresholdsCacheByDevice.get(deviceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.thresholds;
    }

    const fallback: MotorcycleProfileThresholds = {
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
      const motorcycle = await prisma.motorcycle.findFirst({
        where: { 
          deviceId,
          ...(lastUserId ? { userId: lastUserId } : {})
        },
        include: { profile: true },
      });

      const profile =
        motorcycle?.profile ??
        (motoModel
          ? await prisma.motorcycleProfile.findFirst({ where: { name: motoModel } })
          : null);

      if (!profile) {
        this.profileThresholdsCacheByDevice.set(deviceId, {
          expiresAt: Date.now() + 60_000,
          thresholds: fallback,
        });
        return fallback;
      }

      const thresholds: MotorcycleProfileThresholds = {
        maxSpeedKmh: profile.maxSpeedKmh,
        typicalMaxRollDeg: profile.typicalMaxRollDeg,
        crashRollThreshold: profile.crashRollThreshold,
        crashGForce: profile.crashGForce,
        criticalTemp: profile.criticalTemp,
        criticalVoltage: profile.criticalVoltage,
        criticalRpm: (profile as Record<string, unknown>).criticalRpm as number ?? (profile as Record<string, unknown>).rpm_max as number * 0.9,
      };

      this.profileThresholdsCacheByDevice.set(deviceId, {
        expiresAt: Date.now() + 60_000,
        thresholds,
      });

      return thresholds;
    } catch {
      this.profileThresholdsCacheByDevice.set(deviceId, {
        expiresAt: Date.now() + 30_000,
        thresholds: fallback,
      });
      return fallback;
    }
  }

  private async handleHeuristicEvents(payload: TelemetryPayload): Promise<void> {
    const deviceId = payload.system.device_id;
    const tripId = this.activeTripIdByDevice.get(deviceId) ?? null;
    if (!tripId) {
      return;
    }

    const state = this.heuristicStateByDevice.get(deviceId) ?? createInitialHeuristicState();
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

    const evaluation = evaluateTelemetryRisk(payload, state, thresholds, nowMs, dtSec);

    if (evaluation.events.length === 0) {
      return;
    }

    const occurredAtSafe = new Date(payload.system.timestamp);
    const occurredAt = Number.isNaN(occurredAtSafe.getTime()) ? new Date() : occurredAtSafe;

    for (const ev of evaluation.events) {
      try {
        await prisma.tripEvent.create({
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

        if (ev.type === EventType.CRASH_DETECTED) {
          this.sendEmergencyEmail(tripId, payload).catch((err) => {
            console.error("[email] Erro ao enviar email de emergência:", err);
          });
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
      } catch (error) {
        console.error("Erro ao persistir evento heurístico:", error);
      }
    }
  }

  private async handleAlertEvent(payload: TelemetryPayload): Promise<void> {
    const deviceId = payload.system.device_id;
    const status = this.normalizeEventStatus(payload.system.event_status);
    const previousStatus = this.lastEventStatusByDevice.get(deviceId) ?? "NORMAL";

    if (status !== "NORMAL") {
      console.log(`[SocketService] Status detetado em ${deviceId}: "${status}" (Anterior: "${previousStatus}")`);
    }

    if (status !== "NORMAL" && status !== previousStatus) {
      const alert: AlertEvent = {
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

  private handleTripLifecycle(payload: TelemetryPayload): void {
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

    // Se não há viagem ativa mas o simulador enviou TRIP_ENDED,
    // suprimir silenciosamente — NÃO emitir trip_ended para o frontend
    // porque isso causa spam na consola de eventos.
    // Marcar recentStop para bloquear pacotes fantasma subsequentes.
    if (!tripActive && status === "TRIP_ENDED") {
      console.log(`[SocketService] TRIP_ENDED recebido para ${deviceId} sem viagem ativa — suprimido`);
      this.lastTripEndedAtByDevice.set(deviceId, Date.now());
      this.recentStopByDevice.set(deviceId, Date.now());
      return;
    }

    if (!tripActive && (speed >= env.TRIP_START_SPEED_KMH || status === "TRIP_STARTED")) {
      // ── Proteção anti-pacote-fantasma ────────────────────────────────────
      // Quando o utilizador carrega em "Parar", o simulador Python deixa de
      // gerar dados, mas podem chegar ao backend pacotes que já estavam em
      // trânsito no MQTT. Estes pacotes "fantasma" não devem recriar a viagem.
      const recentStop = this.recentStopByDevice.get(deviceId);
      if (recentStop !== undefined && Date.now() - recentStop < 8000) {
        return;
      }
      // Verificação adicional: se a viagem terminou recentemente, não recriar
      const recentTripEnd = this.lastTripEndedAtByDevice.get(deviceId);
      if (recentTripEnd !== undefined && Date.now() - recentTripEnd < 8000) {
        return;
      }
      this.startTrip(payload);
      return;
    }

    if (!tripActive) {
      return;
    }

    if (speed <= env.TRIP_END_SPEED_KMH) {
      const stationaryTicks =
        (this.stationaryTicksByDevice.get(deviceId) ?? 0) + 1;
      this.stationaryTicksByDevice.set(deviceId, stationaryTicks);

      if (stationaryTicks >= env.TRIP_END_STATIONARY_SEC * 10) {
        console.log(`[SocketService] Fim de viagem automático (stationary) em ${deviceId} (${stationaryTicks} ticks)`);
        this.endTrip(payload);
      }
      return;
    }

    this.stationaryTicksByDevice.set(deviceId, 0);
    this.updateTripStats(deviceId, payload);
  }

  private async startTrip(payload: TelemetryPayload): Promise<void> {
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

      let association = await deviceAssociationService.getAssociation(deviceId, lastUserId, motoModel);

      if (!association) {
        // Fallback: tentar sem modelo (qualquer mota registada para este device)
        association = await deviceAssociationService.getAssociation(deviceId, lastUserId);
        
        if (!association) {
          // Último recurso: tentar sem userId nem modelo
          association = await deviceAssociationService.getAssociation(deviceId);
          
          if (!association) {
            console.warn(`[SocketService] Mota não encontrada para deviceId: ${deviceId} (User: ${lastUserId}, Model: ${motoModel}). Viagem ignorada.`);
            return;
          }
        }
      }

      // Verificar na BD se há viagem ativa (segurança extra)
      const dbActiveTrip = await prisma.trip.findFirst({
        where: {
          motorcycleId: association.motorcycleId,
          status: "ACTIVE",
        },
      });

      if (dbActiveTrip) {
        const tripAgeMs = Date.now() - dbActiveTrip.startedAt.getTime();
        const STALE_TRIP_MS = 5 * 60 * 1000; // 5 minutos

        if (tripAgeMs > STALE_TRIP_MS) {
          // Viagem abandonada/fantasma — cancelar e criar nova
          await prisma.trip.update({
            where: { id: dbActiveTrip.id },
            data: { status: "CANCELLED", endedAt: new Date() },
          });
          console.log(`[SocketService] Viagem stale cancelada: ${dbActiveTrip.id} (age: ${Math.round(tripAgeMs / 1000)}s)`);
          // Continuar para criar nova viagem
        } else {
          // Viagem recente — retomar normalmente
          console.log(`[SocketService] Viagem ativa recente na BD para ${deviceId}: ${dbActiveTrip.id} — retomando`);
          this.activeTripIdByDevice.set(deviceId, dbActiveTrip.id);
          this.tripActiveByDevice.set(deviceId, true);
          this.stationaryTicksByDevice.set(deviceId, 0);
          
          if (!this.tripStatsByDevice.has(deviceId)) {
            this.tripStatsByDevice.set(deviceId, {
              maxSpeed: payload.telemetry.speed_kmh,
              maxRoll: Math.abs(payload.imu.roll_deg),
              maxGForce: payload.imu.g_force,
              startLat: payload.location.latitude,
              startLon: payload.location.longitude,
              prevLat: payload.location.latitude,
              prevLon: payload.location.longitude,
              accumulatedDistance: 0,
              speedSum: payload.telemetry.speed_kmh,
              speedTicks: 1,
              startOdometer: payload.telemetry.odometer_km ?? 0,
              ticks: 1,
            });
          }
          return;
        }
      }

      const tripSource = this.resolveSourceForDevice(deviceId);
      const trip = await prisma.trip.create({
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
        prevLat: payload.location.latitude,
        prevLon: payload.location.longitude,
        accumulatedDistance: 0,
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
    } catch (error) {
      console.error("Erro ao criar viagem:", error);
    }
  }

  private updateTripStats(deviceId: string, payload: TelemetryPayload): void {
    const stats = this.tripStatsByDevice.get(deviceId);
    if (!stats) return;

    stats.maxSpeed = Math.max(stats.maxSpeed, payload.telemetry.speed_kmh);
    stats.maxRoll = Math.max(stats.maxRoll, Math.abs(payload.imu.roll_deg));
    stats.maxGForce = Math.max(stats.maxGForce, payload.imu.g_force);
    stats.speedSum += payload.telemetry.speed_kmh;
    stats.speedTicks++;
    stats.ticks++;

    // Distância incremental entre este ponto e o anterior
    if (payload.location) {
      stats.accumulatedDistance += this.haversineDistance(
        stats.prevLat, stats.prevLon,
        payload.location.latitude, payload.location.longitude
      );
      stats.prevLat = payload.location.latitude;
      stats.prevLon = payload.location.longitude;
    }

    // Flush parcial a cada 300 ticks (~30 segundos reais a 10Hz)
    if (stats.ticks % 300 === 0) {
      this.flushTripStats(deviceId);
    }
  }

  private async flushTripStats(deviceId: string): Promise<void> {
    const tripId = this.activeTripIdByDevice.get(deviceId);
    const stats = this.tripStatsByDevice.get(deviceId);
    if (!tripId || !stats) return;

    try {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          maxSpeedKmh: stats.maxSpeed,
          maxRollDeg: stats.maxRoll,
          maxGForce: stats.maxGForce,
          avgSpeedKmh: stats.speedTicks > 0 ? stats.speedSum / stats.speedTicks : null,
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar estatísticas da viagem:", error);
    }
  }

  private async endTrip(payload: TelemetryPayload): Promise<void> {
    const deviceId = payload.system.device_id;
    const timestamp = payload.system.timestamp;
    const tripId = this.activeTripIdByDevice.get(deviceId);
    const stats = this.tripStatsByDevice.get(deviceId);

    this.tripActiveByDevice.set(deviceId, false);
    this.stationaryTicksByDevice.set(deviceId, 0);

    if (!tripId) {
      console.warn(`[SocketService] endTrip: nenhuma viagem ativa para ${deviceId} — suprimido`);
      return;
    }


    await this.flushTripStats(deviceId);
    await this.finalizeTrip({
      deviceId,
      tripId,
      stats,
      payload,
      endedAt: new Date(timestamp),
      doClustering: true,
    });
  }

  private async forceEndTripsOnStopCommand(deviceId: string | null): Promise<void> {
    const activeDevices = Array.from(this.activeTripIdByDevice.keys());
    const preferredDeviceId = deviceId ?? telemetryStore.latest?.system?.device_id ?? null;
    if (activeDevices.length === 0) {
      const fallbackDeviceId =
        preferredDeviceId ??
        Array.from(this.lastTelemetryByDevice.keys()).slice(-1)[0] ??
        null;
      if (!fallbackDeviceId) return;
      await this.forceEndTrip(fallbackDeviceId);
      return;
    }

    const devicesToEnd =
      preferredDeviceId && activeDevices.includes(preferredDeviceId)
        ? [preferredDeviceId]
        : activeDevices;

    await Promise.all(devicesToEnd.map((deviceId) => this.forceEndTrip(deviceId)));
  }

  private async forceEndTrip(deviceId: string): Promise<void> {
    const tripId = this.activeTripIdByDevice.get(deviceId);
    const stats = this.tripStatsByDevice.get(deviceId);
    const lastPayload = this.lastTelemetryByDevice.get(deviceId);
    const endedAt = new Date();

    this.tripActiveByDevice.set(deviceId, false);
    this.stationaryTicksByDevice.set(deviceId, 0);

    if (!tripId) {
      // Sem viagem ativa — NÃO criar viagem fantasma, NÃO emitir trip_ended.
      // Apenas marcar timestamps para bloquear recriações.
      console.log(`[SocketService] forceEndTrip: sem viagem ativa para ${deviceId} — no-op`);
      this.lastTripEndedAtByDevice.set(deviceId, Date.now());
      this.lastStopHandledAtByDevice.set(deviceId, Date.now());
      return;
    }

    await this.flushTripStats(deviceId);
    await this.finalizeTrip({
      deviceId,
      tripId,
      stats,
      payload: lastPayload ?? null,
      endedAt,
      doClustering: false,
      stoppedAt: endedAt,
    });
  }

  private async finalizeTrip(params: {
    deviceId: string;
    tripId: string;
    stats: TripStats | undefined | null;
    payload: TelemetryPayload | null;
    endedAt: Date;
    doClustering: boolean;
    stoppedAt?: Date;
  }): Promise<void> {
    const { deviceId, tripId, stats, payload, endedAt, doClustering, stoppedAt } = params;

    let distanceKm = 0;
    if (stats) {
      const currentOdometer = payload?.telemetry?.odometer_km ?? 0;
      if (currentOdometer > 0 && stats.startOdometer > 0) {
        distanceKm = currentOdometer - stats.startOdometer;
      } else {
        distanceKm = stats.accumulatedDistance;
      }
    }

    const avgSpeedKmh = stats && stats.speedTicks > 0
      ? stats.speedSum / stats.speedTicks
      : null;

    const motoModel = payload?.system?.moto_model ?? this.lastMotoModelByDevice.get(deviceId) ?? "—";

    // ── Debounce de trip_ended por device (3s) ────────────────────────────
    // Evita que o frontend receba múltiplos trip_ended para a mesma viagem.
    const lastEmit = this.lastTripEndedEmitByDevice.get(deviceId) ?? 0;
    const canEmit = Date.now() - lastEmit > 3000;

    try {
      const allZeros = (distanceKm === 0 || distanceKm === null) &&
        (stats?.maxSpeed ?? 0) === 0 &&
        (stats?.maxRoll ?? 0) === 0 &&
        (stats?.maxGForce ?? 0) === 0;

      if (allZeros) {
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            endedAt,
            status: "CANCELLED",
            distanceKm,
            maxSpeedKmh: stats?.maxSpeed ?? 0,
            maxRollDeg: stats?.maxRoll ?? 0,
            maxGForce: stats?.maxGForce ?? 0,
            avgSpeedKmh,
            ...(stoppedAt ? { stoppedAt } : {}),
          },
        });
        console.log(`Viagem cancelada (allZeros): ${tripId}`);
        if (canEmit) {
          this.lastTripEndedEmitByDevice.set(deviceId, Date.now());
          this.io?.emit("trip_ended", {
            deviceId, motoModel, timestamp: endedAt.toISOString(),
            tripId, status: "CANCELLED", error: "Viagem sem dados suficientes",
          });
        }
      } else {
        const trip = await prisma.trip.update({
          where: { id: tripId },
          data: {
            endedAt,
            status: "COMPLETED",
            distanceKm,
            maxSpeedKmh: stats?.maxSpeed ?? 0,
            maxRollDeg: stats?.maxRoll ?? 0,
            maxGForce: stats?.maxGForce ?? 0,
            avgSpeedKmh,
            ...(stoppedAt ? { stoppedAt } : {}),
          },
        });

        console.log(`Viagem finalizada: ${tripId} (${distanceKm.toFixed(2)} km)`);

        if (canEmit) {
          this.lastTripEndedEmitByDevice.set(deviceId, Date.now());
          this.io?.emit("trip_ended", {
            deviceId, motoModel, timestamp: endedAt.toISOString(),
            tripId, distanceKm, maxSpeedKmh: stats?.maxSpeed ?? 0, status: "COMPLETED",
          });
        } else {
          console.log(`[SocketService] trip_ended debounced para ${deviceId} (${Date.now() - lastEmit}ms desde último emit)`);
        }

        if (doClustering && trip?.userId) {
          tripClusteringService.clusterUserTrips(trip.userId).catch((err) => {
            console.error("[clustering] Erro ao clusterizar:", err);
          });
        }
      }

      this.lastTripEndedAtByDevice.set(deviceId, Date.now());
      this.recentStopByDevice.set(deviceId, Date.now());
    } catch (error) {
      console.error("Erro ao finalizar viagem:", error);
      if (canEmit) {
        this.io?.emit("trip_ended", {
          deviceId, motoModel, timestamp: endedAt.toISOString(),
          error: "Falha ao persistir fim da viagem",
        });
      }
    } finally {
      this.activeTripIdByDevice.delete(deviceId);
      this.tripStatsByDevice.delete(deviceId);
      this.heuristicStateByDevice.delete(deviceId);
    }
  }

  private clearRuntimeStateAfterStop(deviceId: string | null): void {
    if (deviceId) {
      this.clearDeviceRuntimeState(deviceId);
      telemetryStore.clearLatestIfDevice(deviceId);
      return;
    }

    const knownDevices = new Set<string>([
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
      telemetryStore.clearLatest();
      return;
    }

    for (const knownDeviceId of knownDevices) {
      this.clearDeviceRuntimeState(knownDeviceId);
      telemetryStore.clearLatestIfDevice(knownDeviceId);
    }
  }

  private clearDeviceRuntimeState(deviceId: string): void {
    this.tripActiveByDevice.delete(deviceId);
    this.stationaryTicksByDevice.delete(deviceId);
    this.lastEventStatusByDevice.delete(deviceId);
    this.lastTelemetryByDevice.delete(deviceId);
    this.activeTripIdByDevice.delete(deviceId);
    this.tripStatsByDevice.delete(deviceId);
    this.lastStopHandledAtByDevice.delete(deviceId);
    this.heuristicStateByDevice.delete(deviceId);
    this.profileThresholdsCacheByDevice.delete(deviceId);
    this.pendingEmergenciesByDevice.delete(deviceId);
    // NÃO limpar recentStopByDevice nem lastTripEndedAtByDevice aqui!
    // Estes guards precisam de sobreviver ao cleanup para bloquear pacotes fantasma.
    this.lastUserIdByDevice.delete(deviceId);
    this.lastMotoModelByDevice.delete(deviceId);
    this.lastSourceByDevice.delete(deviceId);
    this.lastTripEndedEmitByDevice.delete(deviceId);
    realtimeAnomalyService.clearDevice(deviceId);
  }

  // NOTA: createCompletedTripFromLastPayload e createCompletedTripWithoutTelemetry
  // foram removidas — eram dead code que podia causar criação de viagens fantasma.

  private async ensureAssociationForDevice(deviceId: string, userId: string, motoModel: string): Promise<void> {
    this.lastUserIdByDevice.set(deviceId, userId);
    this.lastMotoModelByDevice.set(deviceId, motoModel);
    // Verificar se ESTE utilizador já tem associação com este device e modelo
    const association = await deviceAssociationService.getAssociation(deviceId, userId, motoModel);
    
    // Se a associação encontrada pertence a outro utilizador, ou não existe, registamos/criamos uma nova para este utilizador
    if (association && association.userId === userId) return;

    await deviceAssociationService.registerDevice(deviceId, userId, motoModel || `Simulador ${deviceId}`);
  }

  /** Calcula distância em km entre coordenadas GPS */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private normalizeEventStatus(status: string): string {
    const trimmed = (status || "").trim();
    if (!trimmed) return "NORMAL";
    return trimmed.toUpperCase();
  }

  private getEventTypeFromStatus(status: string): string {
    const s = status.toUpperCase();
    if (s.includes("CRASH") || s.includes("QUEDA") || s.includes("FALL")) return "CRASH_DETECTED";
    if (s.includes("OVERHEAT") || s.includes("SOBREAQUECIMENTO")) return "OVERHEAT";
    if (s.includes("ALTERNADOR") || s.includes("LOW_VOLTAGE") || s.includes("VOLTAGEM")) return "LOW_VOLTAGE";
    if (s.includes("BRAKING") || s.includes("TRAVAGEM")) return "HARD_BRAKING";
    if (s.includes("LEAN") || s.includes("INCLINAÇÃO")) return "EXCESSIVE_LEAN";
    if (s.includes("VIBRATION") || s.includes("VIBRAÇÃO")) return "HIGH_VIBRATION";
    if (s.includes("ACCEL") || s.includes("ACELERAÇÃO")) return "RAPID_ACCELERATION";
    if (s.includes("TIRE") || s.includes("PNEU")) return "TIRE_PRESSURE_LOW";
    if (s.includes("OIL") || s.includes("ÓLEO")) return "OIL_PRESSURE_LOW";
    return "UNKNOWN_EVENT";
  }

  /** Persiste evento de risco na base de dados (etapa 1.12) */
  private async persistTripEvent(payload: TelemetryPayload, status: string): Promise<void> {
    const deviceId = payload.system.device_id;
    let tripId = this.activeTripIdByDevice.get(deviceId);

    // Mapear status para tipo e severidade
    const { eventType, severity, message } = this.mapStatusToEventType(status);

    if (!tripId) {
      if (eventType === "CRASH_DETECTED") {
        console.log(`[SocketService] Queda detetada sem viagem ativa. Iniciando viagem de emergência para ${deviceId}...`);
        await this.startTrip(payload);
        tripId = this.activeTripIdByDevice.get(deviceId);
      } else {
        console.warn(`[SocketService] Alerta "${status}" ignorado em ${deviceId} porque não há viagem ativa.`);
        return;
      }
    }

    if (!tripId) return;

    console.log(`[SocketService] Persistindo evento "${status}" (${eventType}) para viagem ${tripId}`);

    try {
      await prisma.tripEvent.create({
        data: {
          tripId,
          type: eventType as "HARD_BRAKING" | "EXCESSIVE_LEAN" | "HIGH_VIBRATION" | "OVERHEAT" | "LOW_VOLTAGE" | "CRASH_DETECTED" | "RAPID_ACCELERATION" | "TIRE_PRESSURE_LOW" | "OIL_PRESSURE_LOW",
          severity: severity as "INFO" | "WARNING" | "CRITICAL",
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
        this.sendEmergencyEmail(tripId, payload).catch((err) => {
          console.error("[email] Erro ao enviar email de emergência (forceEnd):", err);
        });
      }
    } catch (error) {
      console.error("Erro ao persistir evento de risco:", error);
    }
  }

  private async sendEmergencyEmail(tripId: string, payload: TelemetryPayload): Promise<void> {
    const deviceId = payload.system.device_id;

    // Se já houver um alerta pendente para este dispositivo, ignorar (evitar spam)
    if (this.pendingEmergenciesByDevice.has(deviceId)) return;

    console.log(`[SocketService] Queda detetada em ${deviceId}. Iniciando SOS Countdown (20s).`);
    
    // Notificar frontend para mostrar o contador
    this.io?.emit("crash_detected", { 
      deviceId, 
      countdownSec: 20,
      timestamp: payload.system.timestamp 
    });

    const timeout = setTimeout(async () => {
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          include: { user: true }
        });

        if (trip?.user?.emergencyContact) {
          console.log(`[SocketService] SOS Countdown terminado. Disparando email para ${trip.user.emergencyContact}`);
          
          let decryptedApiKey: string | null = null;
          if (trip.user.resendApiKey) {
            try {
              decryptedApiKey = decrypt(trip.user.resendApiKey, env.ENCRYPTION_KEY);
            } catch (err) {
              console.error("[SocketService] Erro ao desencriptar Resend API Key:", err);
            }
          }

          await sendCrashAlert({
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
      } catch (error) {
        console.error("[SocketService] Erro no fluxo de email de emergência:", error);
      } finally {
        this.pendingEmergenciesByDevice.delete(deviceId);
      }
    }, 20000); // 20 segundos de countdown

    this.pendingEmergenciesByDevice.set(deviceId, timeout);
  }

  private handleCancelEmergency(socket: import("socket.io").Socket, deviceId: string): void {
    const timeout = this.pendingEmergenciesByDevice.get(deviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingEmergenciesByDevice.delete(deviceId);
      console.log(`[SocketService] Emergência CANCELADA pelo utilizador para o dispositivo ${deviceId}`);
      
      // Notificar todos os clientes que foi cancelado (para fechar o popup em outros ecrãs se abertos)
      this.io?.emit("emergency_cancelled", { deviceId });
    }
  }

  private mapStatusToEventType(status: string): { eventType: string; severity: string; message: string } {
    const eventType = this.getEventTypeFromStatus(status);
    
    const severityMap: Record<string, string> = {
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

    const messageMap: Record<string, string> = {
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
  private resolveSourceForDevice(deviceId: string): "SIMULATOR" | "GPX_IMPORTED" | "DEVICE_REAL" {
    const explicit = this.lastSourceByDevice.get(deviceId);
    if (explicit === "GPX_IMPORTED" || explicit === "DEVICE_REAL" || explicit === "SIMULATOR") {
      return explicit;
    }

    const id = deviceId.toUpperCase();
    if (/^MOTOGUARD-GPX/i.test(deviceId) || /-GPX-/i.test(deviceId)) {
      return "GPX_IMPORTED";
    }
    if (/^MOTOGUARD-IRL/i.test(deviceId) || /-IRL-/i.test(deviceId)) {
      return "DEVICE_REAL";
    }

    return "SIMULATOR";
  }
}

// Exporta instância singleton
export const socketService = new SocketService();
