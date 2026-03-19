import { loadSettings } from "./settings";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "unread" | "ack";
export type AlertType =
  | "SPEED"
  | "BRAKING"
  | "TILT"
  | "ENGINE"
  | "BATTERY"
  | "GEOFENCE"
  | "IMPACT"
  | "MAINTENANCE"
  | "OTHER";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  SPEED: "Velocidade",
  BRAKING: "Travagem",
  TILT: "Inclinação",
  ENGINE: "Motor",
  BATTERY: "Bateria",
  GEOFENCE: "Geofence",
  IMPACT: "Impacto",
  MAINTENANCE: "Manutenção",
  OTHER: "Outro",
};

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  timestamp: string;
  type?: AlertType;
  deviceId?: string;
  motoModel?: string;
  tripId?: string;
  lat?: number;
  lng?: number;
  meta?: Record<string, unknown>;
}

const KEY = "motoguard_alerts";

export function loadAlerts(): AlertItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AlertItem[];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: AlertItem[]) {
  localStorage.setItem(KEY, JSON.stringify(alerts));
  window.dispatchEvent(new Event("motoguard:alerts"));
}

export function pushAlert(alert: AlertItem) {
  const settings = loadSettings();
  if (!settings.alerts.enabled) return;

  const severityOrder: Record<AlertSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };
  const minOrder = severityOrder[settings.alerts.minSeverity] ?? 0;
  if (severityOrder[alert.severity] < minOrder) return;

  const current = loadAlerts();
  const exists = current.some((a) => a.id === alert.id);
  const next = exists ? current : [alert, ...current].slice(0, settings.alerts.maxStored);
  saveAlerts(next);

  if (settings.alerts.soundEnabled && typeof window !== "undefined" && "AudioContext" in window) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = alert.severity === "CRITICAL" ? 880 : alert.severity === "WARNING" ? 660 : 440;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
    }
  }
}

