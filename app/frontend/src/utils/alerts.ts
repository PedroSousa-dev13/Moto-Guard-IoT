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

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const out = asString(value, "").trim();
  return out ? out : undefined;
}

function normalizeStoredAlert(value: unknown): AlertItem | null {
  if (!value || typeof value !== "object") return null;
  const alert = value as Record<string, unknown>;
  const id = asString(alert.id, "").trim();
  if (!id) return null;

  const severity = alert.severity;
  const status = alert.status;
  const type = alert.type;
  if (severity !== "INFO" && severity !== "WARNING" && severity !== "CRITICAL") return null;
  if (status !== "unread" && status !== "ack") return null;

  const isValidType =
    type === undefined ||
    type === "SPEED" ||
    type === "BRAKING" ||
    type === "TILT" ||
    type === "ENGINE" ||
    type === "BATTERY" ||
    type === "GEOFENCE" ||
    type === "IMPACT" ||
    type === "MAINTENANCE" ||
    type === "OTHER";
  if (!isValidType) return null;

  return {
    id,
    title: asString(alert.title, "Sem titulo"),
    message: asString(alert.message, ""),
    severity,
    status,
    timestamp: asString(alert.timestamp, new Date().toISOString()),
    type: type as AlertType | undefined,
    deviceId: asOptionalString(alert.deviceId),
    motoModel: asOptionalString(alert.motoModel),
    tripId: asOptionalString(alert.tripId),
    lat: typeof alert.lat === "number" ? alert.lat : undefined,
    lng: typeof alert.lng === "number" ? alert.lng : undefined,
    meta: (alert.meta && typeof alert.meta === "object") ? (alert.meta as Record<string, unknown>) : undefined,
  };
}

export function loadAlerts(): AlertItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStoredAlert)
      .filter((a): a is AlertItem => a !== null);
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

