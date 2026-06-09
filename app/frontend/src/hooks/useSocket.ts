// =============================================================================
// MotoGuard IoT — Hook: useSocket
// =============================================================================
// Gere a ligação Socket.IO ao backend, recebe telemetria em tempo real,
// mantém o estado de ligação e expõe funções para enviar comandos.
// =============================================================================

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  TelemetryPayload,
  LogEntry,
  ConnectionStatus,
  SimulatorCommand,
  AlertEvent,
  TripSocketEvent,
} from "../types/telemetry";
import { pushAlert } from "../utils/alerts";
import { loadSettings } from "../utils/settings";
import { useDemoContext } from "../demo/DemoContext";
import { DemoSocketEmitter } from "../demo/demoSocketEmitter";

/** @deprecated O userId não deve ser lido do localStorage por razões de segurança.
 *  O backend obtém o utilizador autenticado via JWT na ligação WebSocket. */
function getStoredUserId(): string | null {
  return null;
}

export function useSocket() {
  const { isDemoMode, registerEmitter } = useDemoContext();
  const socketRef = useRef<Socket | null>(null);
  const lastKnownDeviceIdRef = useRef<string | null>(null);
  const anomalyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cooldown: após reset, ignorar telemetria do device parado durante 5s
  const telemetryCooldownRef = useRef<{ deviceId: string; until: number } | null>(null);
  const [telemetryByDevice, setTelemetryByDevice] = useState<Record<string, TelemetryPayload>>({});
  const [lastDeviceId, setLastDeviceId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [tripEndedSignal, setTripEndedSignal] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>({
    mqtt: false,
    ws: false,
    hasData: false,
  });
  const [crashAlert, setCrashAlert] = useState<{ deviceId: string; countdownSec: number; timestamp: string } | null>(null);
  const [realtimeAnomaly, setRealtimeAnomaly] = useState<{ deviceId: string; reason: string; score: number; timestamp: string } | null>(null);

  // ── Enviar comando "parar" ao simulador Python (usa refs para não depender de state) ──
  const sendStopCommand = useCallback(() => {
    if (isDemoMode || !socketRef.current) return;
    // Determinar o device_id a partir de refs e state snapshot
    const deviceId =
      lastKnownDeviceIdRef.current ?? undefined;
    const payload = {
      acao: "parar" as const,
      device_id: deviceId,
      source: "SIMULATOR",
    };
    socketRef.current.emit("send_command", payload);
    console.debug(`[useSocket] Stop command sent to ${deviceId}`);
  }, [isDemoMode]);

  const resetSimulationView = useCallback((sendStop = false) => {
    if (sendStop) {
      sendStopCommand();
    }
    // Definir cooldown para o device que está a ser parado
    const deviceToBlock = lastKnownDeviceIdRef.current;
    if (deviceToBlock) {
      telemetryCooldownRef.current = { deviceId: deviceToBlock, until: Date.now() + 5000 };
    }
    setTelemetryByDevice({});
    setLastDeviceId(null);
    setActiveDeviceId(null);
    setMsgCount(0);
    setStatus((prev) => ({ ...prev, hasData: false }));
  }, [sendStopCommand]);

  // ── Adicionar entrada ao log ──────────────────────────────────────────
  const addLog = useCallback((message: string, color: string = "#aaa") => {
    const time = new Date().toLocaleTimeString("pt-PT");
    setLogs((prev) => [{ time, message, color }, ...prev.slice(0, 99)]);
  }, []);

  // ── Enviar comando ao simulador (via WebSocket → backend → MQTT) ──────
  const sendCommand = useCallback(
    (cmd: SimulatorCommand) => {
      if (isDemoMode) {
        addLog("Comando desativado em modo demo", "#71717a");
        return;
      }
      if (socketRef.current) {
        const shouldDefaultToSimulatorDevice =
          cmd.acao === "definir_modelo" ||
          cmd.acao === "parar" ||
          cmd.acao === "evento" ||
          cmd.acao === "reset_eventos" ||
          cmd.acao === "arrancar" ||
          cmd.acao === "definir_rota" ||
          cmd.acao === "reset_rota" ||
          cmd.acao === "set_speed" ||
          cmd.acao === "set_speeding";
        const device_id = cmd.device_id
          ?? activeDeviceId
          ?? lastDeviceId
          ?? lastKnownDeviceIdRef.current
          ?? undefined;
        if (cmd.acao === "override" && !device_id) {
          addLog("Comando override ignorado: sem device_id ativo", "#eab308");
          return;
        }
        const payload = { ...cmd, ...(device_id ? { device_id } : {}) };
        socketRef.current.emit("send_command", payload);
        addLog(`Comando enviado: ${JSON.stringify(payload)}`, "#3b82f6");
      }
    },
    [addLog, activeDeviceId, lastDeviceId, isDemoMode]
  );

  const cancelEmergency = useCallback((deviceId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("cancel_emergency", { deviceId });
      // Também parar o simulador
      socketRef.current.emit("send_command", { acao: "parar", device_id: deviceId, source: "SIMULATOR" });
      setCrashAlert(null);
      addLog(`Cancelamento de emergência e paragem enviados para ${deviceId}`, "#22c55e");
    }
  }, [addLog]);

  const devices = useMemo(() => {
    return Object.keys(telemetryByDevice).sort((a, b) => a.localeCompare(b));
  }, [telemetryByDevice]);

  const telemetry = useMemo(() => {
    const deviceId = activeDeviceId ?? lastDeviceId;
    if (!deviceId) return null;
    return telemetryByDevice[deviceId] ?? null;
  }, [activeDeviceId, lastDeviceId, telemetryByDevice]);

  // ── Efeito: ligar Socket.IO ao montar ─────────────────────────────────
  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: use DemoSocketEmitter instead of Socket.IO
      const emitter = new DemoSocketEmitter();
      registerEmitter(emitter);

      emitter.on("connect", () => {
        setStatus((prev) => ({ ...prev, ws: true }));
        addLog("WebSocket conectado (modo demo)", "#22c55e");
      });

      emitter.on("status", (data: unknown) => {
        const d = data as { mqttConnected: boolean; telemetryCount: number; hasData: boolean };
        setStatus((prev) => ({ ...prev, mqtt: d.mqttConnected, hasData: d.hasData }));
        addLog(`Estado demo: MQTT=${d.mqttConnected ? "✓" : "✗"} | msgs=${d.telemetryCount}`, "#71717a");
      });

      emitter.on("telemetry_update", (data: unknown) => {
        const payload = data as TelemetryPayload;
        const deviceId = payload.system.device_id;
        lastKnownDeviceIdRef.current = deviceId;
        setTelemetryByDevice((prev) => ({ ...prev, [deviceId]: payload }));
        setLastDeviceId(deviceId);
        setActiveDeviceId((prev) => (prev ? prev : deviceId));
        setMsgCount((prev) => prev + 1);
        setStatus((prev) => ({ ...prev, mqtt: true, hasData: true }));
      });

      emitter.on("trip_started", (data: unknown) => {
        const d = data as TripSocketEvent;
        addLog(`Viagem iniciada: ${d.motoModel} (${d.deviceId})`, "#22c55e");
      });

      emitter.start();
      addLog("Dashboard MotoGuard iniciado — modo demo ativo", "#71717a");

      return () => emitter.stop();
    }

    // Real Socket.IO connection
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus((prev) => ({ ...prev, ws: true }));
      addLog("WebSocket conectado", "#22c55e");
    });

    socket.on("disconnect", () => {
      setStatus((prev) => ({ ...prev, ws: false }));
      addLog("WebSocket desconectado", "#ef4444");
    });

    socket.on("status", (data: { mqttConnected: boolean; telemetryCount: number; hasData: boolean }) => {
      setStatus((prev) => ({
        ...prev,
        mqtt: data.mqttConnected,
        hasData: data.hasData,
      }));
      addLog(
        `Estado: MQTT=${data.mqttConnected ? "✓" : "✗"} | msgs=${data.telemetryCount}`,
        "#71717a"
      );
    });

    socket.on("telemetry_update", (data: TelemetryPayload) => {
      const deviceId = data.system.device_id;

      // Verificar cooldown: após reset, ignorar telemetria do device parado
      const cooldown = telemetryCooldownRef.current;
      if (cooldown && cooldown.deviceId === deviceId && Date.now() < cooldown.until) {
        return;
      }
      if (cooldown && Date.now() >= cooldown.until) {
        telemetryCooldownRef.current = null; // expirou
      }

      lastKnownDeviceIdRef.current = deviceId;
      setTelemetryByDevice((prev) => ({ ...prev, [deviceId]: data }));
      setLastDeviceId(deviceId);
      
      setActiveDeviceId((prev) => {
        // Se já temos um device ativo e não é o default simulator, mantemos
        if (prev && prev === deviceId) return prev;
        
        // Auto-switch se for um novo simulador e o atual for o default ou null
        const isNewSim = deviceId.toUpperCase().includes("-SIM-");
        const isPrevSim = prev?.toUpperCase().includes("-SIM-") ?? true;
        
        if (isNewSim && isPrevSim) {
          return deviceId;
        }
        return prev ?? deviceId;
      });

      setMsgCount((prev) => prev + 1);
      setStatus((prev) => ({ ...prev, mqtt: true, hasData: true }));
    });

    socket.on("alert", (data: AlertEvent) => {
      const status = data.status.replace(/_/g, " ");
      addLog(`ALERTA [${status}] ${data.motoModel} (${data.deviceId})`, "#f97316");

      const settings = loadSettings();
      if (settings.alerts.enabled) {
        const id = `${data.deviceId}:${data.timestamp}:${data.status}`;
        const severity = data.status.includes("CRASH") || data.status.includes("FALL")
          ? "CRITICAL"
          : data.status.includes("OVER") || data.status.includes("ALT")
            ? "WARNING"
            : "INFO";
        pushAlert({
          id,
          title: status,
          message: `Alerta emitido por ${data.motoModel} (${data.deviceId})`,
          severity,
          status: "unread",
          timestamp: data.timestamp,
          deviceId: data.deviceId,
          motoModel: data.motoModel,
          meta: data as unknown as Record<string, unknown>,
        });
      }
    });

    socket.on("trip_started", (data: TripSocketEvent) => {
      addLog(
        `Viagem iniciada: ${data.motoModel} (${data.deviceId})`,
        "#22c55e"
      );
    });

    socket.on("trip_ended", (data: TripSocketEvent) => {
      addLog(`Viagem terminada: ${data.motoModel} (${data.deviceId})`, "#eab308");
      setTripEndedSignal((v) => v + 1);
    });

    socket.on("error_msg", (data: { message: string }) => {
      addLog(`Erro: ${data.message}`, "#ef4444");
    });

    socket.on("crash_detected", (data: { deviceId: string; countdownSec: number; timestamp: string }) => {
      setCrashAlert(data);
      addLog(`🚨 QUEDA DETETADA em ${data.deviceId}! SOS Countdown iniciado.`, "#ef4444");
    });

    socket.on("emergency_cancelled", (data: { deviceId: string }) => {
      setCrashAlert(null);
      addLog(`SOS Countdown cancelado para ${data.deviceId}`, "#22c55e");
    });

    socket.on("realtime_anomaly", (data: { deviceId: string; reason: string; score?: number; timestamp?: string }) => {
      setRealtimeAnomaly(data);
      addLog(`🚨 ANOMALIA ML em ${data.deviceId}: ${data.reason}`, "#ef4444");
      if (anomalyTimerRef.current) clearTimeout(anomalyTimerRef.current);
      anomalyTimerRef.current = setTimeout(() => setRealtimeAnomaly(null), 5000);
    });

    // Verificar estado do backend ao montar
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.mqtt?.connected) {
          setStatus((prev) => ({ ...prev, mqtt: true }));
        }
        addLog(
          `Health OK — MQTT: ${d.mqtt?.connected ? "✓" : "✗"} | msgs: ${d.stats?.telemetryCount || 0}`,
          "#22c55e"
        );
      })
      .catch(() => addLog("Erro ao obter health check", "#ef4444"));

    addLog("Dashboard MotoGuard iniciado — à espera de dados...", "#71717a");

    return () => {
      if (anomalyTimerRef.current) clearTimeout(anomalyTimerRef.current);
      socket.disconnect();
    };
  }, [addLog, isDemoMode, registerEmitter]);

  const getLastKnownDeviceId = useCallback(() => lastKnownDeviceIdRef.current, []);

  return { telemetry, telemetryByDevice, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal, msgCount, logs, status, sendCommand, sendStopCommand, addLog, resetSimulationView, crashAlert, cancelEmergency, realtimeAnomaly, getLastKnownDeviceId };
}
