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

function getStoredUserId(): string | null {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  const storage = rememberMe ? localStorage : sessionStorage;
  const key = rememberMe ? "user" : "session_user";
  const raw = storage.getItem(key) || localStorage.getItem(key) || sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
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

  const resetSimulationView = useCallback(() => {
    setTelemetryByDevice({});
    setLastDeviceId(null);
    setActiveDeviceId(null);
    setMsgCount(0);
    setStatus((prev) => ({ ...prev, hasData: false }));
  }, []);

  // ── Adicionar entrada ao log ──────────────────────────────────────────
  const addLog = useCallback((message: string, color: string = "#aaa") => {
    const time = new Date().toLocaleTimeString("pt-PT");
    setLogs((prev) => [{ time, message, color }, ...prev.slice(0, 99)]);
  }, []);

  // ── Enviar comando ao simulador (via WebSocket → backend → MQTT) ──────
  const sendCommand = useCallback(
    (cmd: SimulatorCommand) => {
      if (socketRef.current) {
        const shouldDefaultToSimulatorDevice =
          cmd.acao === "definir_modelo" ||
          cmd.acao === "parar" ||
          cmd.acao === "evento" ||
          cmd.acao === "reset_eventos" ||
          cmd.acao === "arrancar" ||
          cmd.acao === "definir_rota" ||
          cmd.acao === "reset_rota";
        const device_id = cmd.device_id
          ?? (shouldDefaultToSimulatorDevice ? "MOTOGUARD-SIM-01" : undefined)
          ?? activeDeviceId
          ?? lastDeviceId;
        const userId = cmd.userId ?? getStoredUserId() ?? undefined;
        const payload = { ...cmd, ...(device_id ? { device_id } : {}), ...(userId ? { userId } : {}) };
        socketRef.current.emit("send_command", payload);
        addLog(`Comando enviado: ${JSON.stringify(payload)}`, "#3b82f6");
      }
    },
    [addLog, activeDeviceId, lastDeviceId]
  );

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
      setTelemetryByDevice((prev) => ({ ...prev, [deviceId]: data }));
      setLastDeviceId(deviceId);
      setActiveDeviceId((prev) => (prev ? prev : deviceId));
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
      socket.disconnect();
    };
  }, [addLog]);

  return { telemetry, telemetryByDevice, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal, msgCount, logs, status, sendCommand, addLog, resetSimulationView };
}
