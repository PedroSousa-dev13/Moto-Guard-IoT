export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "unread" | "ack";

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  timestamp: string;
  deviceId?: string;
  motoModel?: string;
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
  const current = loadAlerts();
  const exists = current.some((a) => a.id === alert.id);
  const next = exists ? current : [alert, ...current].slice(0, 500);
  saveAlerts(next);
}

