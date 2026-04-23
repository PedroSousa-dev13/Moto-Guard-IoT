// =============================================================================
// MotoGuard IoT — Hook: useNotifications
// =============================================================================
// Subscreve eventos Socket.IO de alerta e trip, persiste em localStorage,
// expõe contagem de não lidas e funções de gestão.
// =============================================================================

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { pushAlert, loadAlerts, saveAlerts, type AlertItem, type AlertSeverity } from "../utils/alerts";
import { loadSettings } from "../utils/settings";

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  tripId?: string;
  timestamp: string;
  predictive?: boolean;
}

let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getOrCreateSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io({ autoConnect: true });
  }
  return sharedSocket;
}

export function useNotifications() {
  const socketRef = useRef<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnread = useCallback(() => {
    const count = loadAlerts().filter((a) => a.status === "unread").length;
    setUnreadCount(count);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const markAllRead = useCallback(() => {
    const alerts = loadAlerts().map((a) => ({ ...a, status: "ack" as const }));
    saveAlerts(alerts);
    refreshUnread();
  }, [refreshUnread]);

  const markRead = useCallback((id: string) => {
    const alerts = loadAlerts().map((a) =>
      a.id === id ? { ...a, status: "ack" as const } : a
    );
    saveAlerts(alerts);
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    refreshUnread();
    const onStorage = () => refreshUnread();
    window.addEventListener("motoguard:alerts", onStorage);
    return () => window.removeEventListener("motoguard:alerts", onStorage);
  }, [refreshUnread]);

  useEffect(() => {
    socketRefCount++;
    const socket = getOrCreateSocket();
    socketRef.current = socket;

    const handleAlert = (data: {
      status: string;
      severity?: string;
      message?: string;
      deviceId: string;
      motoModel: string;
      timestamp: string;
      tripId?: string;
    }) => {
      const settings = loadSettings();
      if (!settings.alerts.enabled) return;

      const rawSeverity = data.severity ?? (
        data.status.includes("CRASH") || data.status.includes("FALL") ? "CRITICAL"
          : data.status.includes("OVER") || data.status.includes("ALT") ? "WARNING"
            : "INFO"
      );
      const severity = rawSeverity as AlertSeverity;

      const id = `${data.deviceId}:${data.timestamp}:${data.status}`;
      const titleMapping: Record<string, string> = {
        ENGINE_OVERREV: "Rotações Excessivas",
        WHEELIE_DETECTED: "Wheelie Detetado",
        STOPPIE_DETECTED: "Stoppie Detetado",
        SAFETY_SYSTEM_ACTIVE: "Sistema de Segurança Ativo",
        HARD_BRAKING: "Travagem Brusca",
        EXCESSIVE_LEAN: "Inclinação Excessiva",
        HIGH_VIBRATION: "Vibração Anómala",
        OVERHEAT: "Sobreaquecimento",
        LOW_VOLTAGE: "Voltagem Baixa",
        CRASH_DETECTED: "Queda Detetada",
        RAPID_ACCELERATION: "Aceleração Brusca",
        TIRE_PRESSURE_LOW: "Pressão Pneus Baixa",
        OIL_PRESSURE_LOW: "Pressão Óleo Baixa",
        SPEEDING: "Excesso Velocidade",
      };
      const title = titleMapping[data.status] ?? data.status.replace(/_/g, " ");
      
      const typeMapping: Record<string, AlertType> = {
        WHEELIE_DETECTED: "TILT",
        STOPPIE_DETECTED: "TILT",
        EXCESSIVE_LEAN: "TILT",
        SPEEDING: "SPEED",
        HARD_BRAKING: "BRAKING",
        RAPID_ACCELERATION: "SPEED",
        ENGINE_OVERREV: "ENGINE",
        OVERHEAT: "ENGINE",
        LOW_VOLTAGE: "BATTERY",
        OIL_PRESSURE_LOW: "ENGINE",
        TIRE_PRESSURE_LOW: "OTHER",
        CRASH_DETECTED: "IMPACT",
        SAFETY_SYSTEM_ACTIVE: "OTHER",
      };
      const alertType = typeMapping[data.status] ?? "OTHER";
      const message = data.message ?? `Alerta de ${data.motoModel} (${data.deviceId})`;
      const isPredictive = message.toLowerCase().includes("tendência") || message.toLowerCase().includes("possível");

      const alert: AlertItem = {
        id,
        title,
        message,
        severity,
        status: "unread",
        timestamp: data.timestamp,
        type: alertType,
        deviceId: data.deviceId,
        motoModel: data.motoModel,
        tripId: data.tripId,
        meta: { ...(data as unknown as Record<string, unknown>), predictive: isPredictive },
      };

      pushAlert(alert);
      refreshUnread();

      // Toast para WARNING e CRITICAL (não para preditivos INFO)
      if (severity === "CRITICAL" || severity === "WARNING") {
        const newToast: ToastNotification = {
          id,
          title: isPredictive ? `📈 ${title}` : title,
          message,
          severity,
          tripId: data.tripId,
          timestamp: data.timestamp,
          predictive: isPredictive,
        };
        setToast(newToast);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const autoDismissMs = severity === "CRITICAL" ? 10000 : 6000;
        toastTimerRef.current = setTimeout(() => setToast(null), autoDismissMs);
      }
    };

    const handleTripStarted = (data: { deviceId: string; motoModel: string; timestamp: string; tripId?: string }) => {
      const settings = loadSettings();
      if (!settings.alerts.enabled) return;
      const id = `trip_started:${data.deviceId}:${data.timestamp}`;
      pushAlert({
        id,
        title: "Viagem iniciada",
        message: `${data.motoModel} (${data.deviceId})`,
        severity: "INFO",
        status: "unread",
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        motoModel: data.motoModel,
        tripId: data.tripId,
      });
      refreshUnread();
    };

    const handleTripEnded = (data: { deviceId: string; motoModel: string; timestamp: string; tripId?: string; distanceKm?: number }) => {
      const settings = loadSettings();
      if (!settings.alerts.enabled) return;
      const id = `trip_ended:${data.deviceId}:${data.timestamp}`;
      const dist = data.distanceKm != null ? ` · ${data.distanceKm.toFixed(1)} km` : "";
      pushAlert({
        id,
        title: "Viagem terminada",
        message: `${data.motoModel} (${data.deviceId})${dist}`,
        severity: "INFO",
        status: "unread",
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        motoModel: data.motoModel,
        tripId: data.tripId,
      });
      refreshUnread();
    };

    socket.on("alert", handleAlert);
    socket.on("trip_started", handleTripStarted);
    socket.on("trip_ended", handleTripEnded);

    return () => {
      socket.off("alert", handleAlert);
      socket.off("trip_started", handleTripStarted);
      socket.off("trip_ended", handleTripEnded);
      socketRefCount--;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [refreshUnread]);

  return { unreadCount, toast, dismissToast, markAllRead, markRead, refreshUnread };
}
