export type Theme = "light" | "dark";
export type Units = "metric" | "imperial";

export interface AppSettings {
  theme: Theme;
  units: Units;
  alerts: {
    enabled: boolean;
    autoAckOnOpen: boolean;
  };
}

const KEY = "motoguard_settings";

export function defaultSettings(): AppSettings {
  return {
    theme: "light",
    units: "metric",
    alerts: {
      enabled: true,
      autoAckOnOpen: false,
    },
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const base = defaultSettings();
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      units: parsed.units === "imperial" ? "imperial" : "metric",
      alerts: {
        enabled: typeof parsed.alerts?.enabled === "boolean" ? parsed.alerts.enabled : base.alerts.enabled,
        autoAckOnOpen: typeof parsed.alerts?.autoAckOnOpen === "boolean" ? parsed.alerts.autoAckOnOpen : base.alerts.autoAckOnOpen,
      },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  applyTheme(s.theme);
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

