export type Theme = "light" | "dark";
export type Units = "metric" | "imperial";
export type Language = "pt" | "en" | "es";
export type AlertMinSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Thresholds {
  maxSpeedKmhWarn: number;
  maxSpeedKmhCrit: number;
  maxGForceWarn: number;
  maxGForceCrit: number;
  maxRollDegWarn: number;
  maxRollDegCrit: number;
  maxEngineTempCWarn: number;
  maxEngineTempCCrit: number;
}

export interface AppSettings {
  theme: Theme;
  units: Units;
  language: Language;
  alerts: {
    enabled: boolean;
    autoAckOnOpen: boolean;
    minSeverity: AlertMinSeverity;
    maxStored: number;
    soundEnabled: boolean;
  };
  thresholds: Thresholds;
}

const KEY = "motoguard_settings";

export function defaultThresholds(): Thresholds {
  return {
    maxSpeedKmhWarn: 120,
    maxSpeedKmhCrit: 150,
    maxGForceWarn: 0.6,
    maxGForceCrit: 0.8,
    maxRollDegWarn: 40,
    maxRollDegCrit: 55,
    maxEngineTempCWarn: 110,
    maxEngineTempCCrit: 130,
  };
}

export function defaultSettings(): AppSettings {
  return {
    theme: "light",
    units: "metric",
    language: "pt",
    alerts: {
      enabled: true,
      autoAckOnOpen: false,
      minSeverity: "INFO",
      maxStored: 500,
      soundEnabled: false,
    },
    thresholds: defaultThresholds(),
  };
}

function safeNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const base = defaultSettings();
    const dt = base.thresholds;
    const pt = (parsed.thresholds ?? {}) as Partial<Thresholds>;
    const maxStored = Number(parsed.alerts?.maxStored);
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      units: parsed.units === "imperial" ? "imperial" : "metric",
      language: (["pt", "en", "es"] as Language[]).includes(parsed.language as Language)
        ? (parsed.language as Language)
        : base.language,
      alerts: {
        enabled: typeof parsed.alerts?.enabled === "boolean" ? parsed.alerts.enabled : base.alerts.enabled,
        autoAckOnOpen: typeof parsed.alerts?.autoAckOnOpen === "boolean" ? parsed.alerts.autoAckOnOpen : base.alerts.autoAckOnOpen,
        minSeverity: (["INFO", "WARNING", "CRITICAL"] as AlertMinSeverity[]).includes(parsed.alerts?.minSeverity as AlertMinSeverity)
          ? (parsed.alerts!.minSeverity as AlertMinSeverity)
          : base.alerts.minSeverity,
        maxStored: Number.isFinite(maxStored) && maxStored >= 10 && maxStored <= 2000 ? maxStored : base.alerts.maxStored,
        soundEnabled: typeof parsed.alerts?.soundEnabled === "boolean" ? parsed.alerts.soundEnabled : base.alerts.soundEnabled,
      },
      thresholds: {
        maxSpeedKmhWarn: safeNum(pt.maxSpeedKmhWarn, 60, 200, dt.maxSpeedKmhWarn),
        maxSpeedKmhCrit: safeNum(pt.maxSpeedKmhCrit, 80, 300, dt.maxSpeedKmhCrit),
        maxGForceWarn: safeNum(pt.maxGForceWarn, 0.1, 5, dt.maxGForceWarn),
        maxGForceCrit: safeNum(pt.maxGForceCrit, 0.1, 5, dt.maxGForceCrit),
        maxRollDegWarn: safeNum(pt.maxRollDegWarn, 10, 90, dt.maxRollDegWarn),
        maxRollDegCrit: safeNum(pt.maxRollDegCrit, 10, 90, dt.maxRollDegCrit),
        maxEngineTempCWarn: safeNum(pt.maxEngineTempCWarn, 60, 200, dt.maxEngineTempCWarn),
        maxEngineTempCCrit: safeNum(pt.maxEngineTempCCrit, 60, 200, dt.maxEngineTempCCrit),
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
